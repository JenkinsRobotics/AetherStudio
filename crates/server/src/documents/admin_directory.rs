//! Administrative projections and legacy team/access changes use the same
//! identity and ACL transaction as document authorization. No credential fields.
use super::{Documents, Error, Result, commit, db, valid_id};
use serde::Deserialize;
use serde_json::{Value, json};
use tokio_postgres::error::SqlState;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TeamChange {
    #[serde(default)]
    pub id: String,
    pub action: Option<String>,
    pub name: Option<String>,
    pub members: Option<Vec<String>>,
    pub apps: Option<Vec<String>>,
}
impl Documents {
    pub async fn set_app_restricted(&self, token: &str, app: &str, restricted: bool) -> Result<()> {
        if !valid_id(app) || app == "ui" {
            return Err(Error::Invalid);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, true).await?;
        if user.role != aether_identity::Role::Admin {
            return Err(aether_identity::Error::Forbidden.into());
        }
        let row = tx
            .query_opt(
                "SELECT restricted FROM aether_access.applications WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &app],
            )
            .await
            .map_err(db)?
            .ok_or(Error::Invalid)?;
        if row.get::<_, bool>(0) != restricted {
            tx.execute(
                "UPDATE aether_access.applications SET restricted=$3 WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &app, &restricted],
            )
            .await
            .map_err(db)?;
            self.audit(&tx, &user, "app_access_changed", app).await?;
        }
        commit(tx).await
    }
    pub async fn admin_team(&self, token: &str, change: &TeamChange) -> Result<String> {
        let deleting = change.action.as_deref() == Some("delete");
        if change
            .action
            .as_deref()
            .is_some_and(|a| !matches!(a, "delete" | "save"))
            || (!change.id.is_empty() && !valid_id(&change.id))
            || (deleting && change.id.is_empty())
        {
            return Err(Error::Invalid);
        }
        let team = if change.id.is_empty() {
            {
                let mut bytes = [0u8; 16];
                getrandom::fill(&mut bytes).map_err(|_| Error::Unavailable)?;
                bytes.iter().map(|b| format!("{b:02x}")).collect()
            }
        } else {
            change.id.clone()
        };
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, true).await?;
        if user.role != aether_identity::Role::Admin {
            return Err(aether_identity::Error::Forbidden.into());
        }
        if deleting {
            tx.execute(
                "DELETE FROM aether_access.team_members WHERE tenant=$1 AND team=$2",
                &[&self.tenant(), &team],
            )
            .await
            .map_err(db)?;
            tx.execute(
                "DELETE FROM aether_access.team_apps WHERE tenant=$1 AND team=$2",
                &[&self.tenant(), &team],
            )
            .await
            .map_err(db)?;
            if tx
                .execute(
                    "DELETE FROM aether_access.teams WHERE tenant=$1 AND id=$2",
                    &[&self.tenant(), &team],
                )
                .await
                .map_err(db)?
                > 0
            {
                self.audit(&tx, &user, "team_deleted", &team).await?;
            }
        } else {
            let name = change.name.as_deref().ok_or(Error::Invalid)?.trim();
            let members = change.members.as_ref().ok_or(Error::Invalid)?;
            let apps = change.apps.as_ref().ok_or(Error::Invalid)?;
            if name.is_empty()
                || name.chars().count() > 80
                || name.chars().any(char::is_control)
                || members.len() > 1000
                || apps.len() > 128
                || members.iter().chain(apps).any(|id| !valid_id(id))
                || apps.iter().any(|id| id == "ui")
            {
                return Err(Error::Invalid);
            }
            self.configure_team_in(&tx, &team, members, apps).await?;
            tx.execute("INSERT INTO aether_access.team_labels VALUES($1,$2,$3) ON CONFLICT(tenant,team) DO UPDATE SET name=excluded.name", &[&self.tenant(),&team,&name]).await.map_err(|e| if e.code()==Some(&SqlState::UNIQUE_VIOLATION) {Error::Conflict} else {db(e)})?;
            self.audit(&tx, &user, "team_saved", &team).await?;
        }
        commit(tx).await?;
        Ok(team)
    }
    /// Bounded complete administrative directory; fail explicitly rather than
    /// silently truncating the users/teams lists used by the permission editor.
    pub async fn admin_directory(&self, token: &str) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        if user.role != aether_identity::Role::Admin {
            return Err(aether_identity::Error::Forbidden.into());
        }
        let users=tx.query("SELECT id,username,role,active,must_change,full_name,email,email_verified FROM aether_identity.users WHERE tenant=$1 ORDER BY username LIMIT 5001", &[&self.tenant()]).await.map_err(db)?;
        let teams=tx.query("SELECT t.id,coalesce(l.name,t.id),ARRAY(SELECT user_id FROM aether_access.team_members m WHERE m.tenant=t.tenant AND m.team=t.id ORDER BY user_id),ARRAY(SELECT app FROM aether_access.team_apps a WHERE a.tenant=t.tenant AND a.team=t.id ORDER BY app) FROM aether_access.teams t LEFT JOIN aether_access.team_labels l ON l.tenant=t.tenant AND l.team=t.id WHERE t.tenant=$1 ORDER BY coalesce(l.name,t.id) LIMIT 5001", &[&self.tenant()]).await.map_err(db)?;
        if users.len() > 5000 || teams.len() > 5000 {
            return Err(Error::TooLarge);
        }
        let access = tx
            .query(
                "SELECT id,restricted,enabled FROM aether_access.applications WHERE tenant=$1 ORDER BY id",
                &[&self.tenant()],
            )
            .await
            .map_err(db)?;
        let sessions=tx.query("SELECT u.username,count(*) FROM aether_identity.sessions s JOIN aether_identity.users u ON u.tenant=s.tenant AND u.id=s.user_id WHERE s.tenant=$1 AND s.expires>clock_timestamp() AND u.active GROUP BY u.username ORDER BY u.username", &[&self.tenant()]).await.map_err(db)?;
        let audit=tx.query("SELECT actor,action,target,EXTRACT(EPOCH FROM happened_at)::double precision FROM (SELECT actor,action,target,happened_at FROM aether_identity.audit WHERE tenant=$1 UNION ALL SELECT actor,action,target,happened_at FROM aether_access.audit WHERE tenant=$1) events ORDER BY happened_at DESC,actor,action,target LIMIT 100", &[&self.tenant()]).await.map_err(db)?;
        let value = json!({
            "users":users.iter().map(|r|json!({"id":r.get::<_,String>(0),"username":r.get::<_,String>(1),"role":r.get::<_,String>(2),"active":r.get::<_,bool>(3),"must_change":r.get::<_,bool>(4),"full_name":r.get::<_,String>(5),"email":r.get::<_,String>(6),"email_verified":r.get::<_,bool>(7)})).collect::<Vec<_>>(),
            "teams":teams.iter().map(|r|json!({"id":r.get::<_,String>(0),"name":r.get::<_,String>(1),"members":r.get::<_,Vec<String>>(2),"apps":r.get::<_,Vec<String>>(3)})).collect::<Vec<_>>(),
            "application_enabled":access.iter().map(|r|(r.get::<_,String>(0),json!(r.get::<_,bool>(2)))).collect::<serde_json::Map<String,Value>>(),
            "access":access.iter().map(|r|(r.get::<_,String>(0),json!(u8::from(r.get::<_,bool>(1))))).collect::<serde_json::Map<String,Value>>(),
            "sessions":sessions.iter().map(|r|json!({"username":r.get::<_,String>(0),"count":r.get::<_,i64>(1)})).collect::<Vec<_>>(),
            "audit":audit.iter().enumerate().map(|(id,r)|json!({"id":id,"actor":r.get::<_,String>(0),"action":r.get::<_,String>(1),"target":r.get::<_,String>(2),"time":r.get::<_,f64>(3)})).collect::<Vec<_>>()
        });
        commit(tx).await?;
        Ok(value)
    }
}
