//! Authenticated access changes share the tenant ACL lock with document commits.
use super::{Documents, Error, Location, Result, Role, commit, db, valid_id};
use aether_identity::User;
use tokio_postgres::Transaction;

impl Documents {
    pub(super) fn admin(user: &User) -> Result<()> {
        if user.role == aether_identity::Role::Admin {
            Ok(())
        } else {
            Err(Error::Denied)
        }
    }
    pub(super) async fn active_user(&self, tx: &Transaction<'_>, id: &str) -> Result<()> {
        if !valid_id(id) {
            return Err(Error::Invalid);
        }
        let row = tx
            .query_opt(
                "SELECT role FROM aether_identity.users WHERE tenant=$1 AND id=$2 AND active",
                &[&self.tenant(), &id],
            )
            .await
            .map_err(db)?
            .ok_or(Error::Denied)?;
        self.enroll_id(tx, id, row.get::<_, &str>(0) == "admin")
            .await
    }
    pub async fn configure_app(
        &self,
        token: &str,
        app: &str,
        enabled: bool,
        restricted: bool,
    ) -> Result<()> {
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
        Self::admin(&user)?;
        tx.execute("INSERT INTO aether_access.applications VALUES($1,$2,$3,$4) ON CONFLICT(tenant,id) DO UPDATE SET enabled=excluded.enabled,restricted=excluded.restricted",&[&self.tenant(),&app,&enabled,&restricted]).await.map_err(db)?;
        self.audit(&tx, &user, "configure_app", app).await?;
        commit(tx).await
    }
    /// Legacy admin toggle: preserve the independently managed restriction/team
    /// policy. A toggle cannot create a new app or grant it to other users.
    pub async fn set_app_enabled(&self, token: &str, app: &str, enabled: bool) -> Result<()> {
        if !valid_id(app) {
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
                "SELECT enabled FROM aether_access.applications WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &app],
            )
            .await
            .map_err(db)?
            .ok_or(Error::Invalid)?;
        if row.get::<_, bool>(0) != enabled {
            tx.execute(
                "UPDATE aether_access.applications SET enabled=$3 WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &app, &enabled],
            )
            .await
            .map_err(db)?;
            self.audit(
                &tx,
                &user,
                if enabled {
                    "app_enabled"
                } else {
                    "app_disabled"
                },
                app,
            )
            .await?;
        }
        commit(tx).await
    }
    /// Only an owner may share a resource. Server administrators are not private
    /// document owners. As in Drive, grants offer view/edit, never ownership.
    pub async fn grant(
        &self,
        token: &str,
        id: &str,
        target: &str,
        role: Option<Role>,
    ) -> Result<()> {
        if role == Some(Role::Owner) {
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
        let resource = self.require(&tx, &user, id, Role::Owner).await?;
        self.app(&tx, &user, &resource.app).await?;
        self.active_user(&tx, target).await?;
        if self
            .member(&tx, target, &resource.location.organization)
            .await?
            .is_none()
        {
            return Err(Error::Denied);
        }
        self.grant_in(&tx, &user, id, target, role).await?;
        commit(tx).await
    }
    /// Caller holds the exclusive ACL lock and has validated current authority.
    pub(super) async fn grant_in(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
        target: &str,
        role: Option<Role>,
    ) -> Result<()> {
        if let Some(role) = role {
            let existing = tx.query_opt("SELECT 1 FROM aether_access.grants WHERE tenant=$1 AND resource=$2 AND user_id=$3", &[&self.tenant(), &id, &target]).await.map_err(db)?.is_some();
            tx.execute("INSERT INTO aether_access.grants VALUES($1,$2,$3,$4) ON CONFLICT(tenant,resource,user_id) DO UPDATE SET role=excluded.role",&[&self.tenant(),&id,&target,&role.sql()]).await.map_err(db)?;
            // Changing a role does not rewrite who first shared this grant.
            // Older grants with unknown provenance must stay unknown.
            if !existing {
                tx.execute("INSERT INTO aether_access.grant_provenance(tenant,resource,user_id,shared_by,shared_at) VALUES($1,$2,$3,$4,EXTRACT(EPOCH FROM clock_timestamp())::double precision)", &[&self.tenant(), &id, &target, &user.id]).await.map_err(db)?;
            }
        } else {
            tx.execute(
                "DELETE FROM aether_access.grants WHERE tenant=$1 AND resource=$2 AND user_id=$3",
                &[&self.tenant(), &id, &target],
            )
            .await
            .map_err(db)?;
        }
        self.audit(tx, user, "grant", id).await
    }
    pub async fn create_folder(&self, token: &str, id: &str, location: &Location) -> Result<()> {
        self.create_named_folder(token, id, location, id).await
    }
    pub async fn create_named_folder(
        &self,
        token: &str,
        id: &str,
        location: &Location,
        name: &str,
    ) -> Result<()> {
        let name = name.trim();
        if name.is_empty() || name.len() > 1024 || name.chars().any(char::is_control) {
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
        self.app(&tx, &user, "drive").await?;
        self.destination(&tx, &user, location).await?;
        if self.resource(&tx, id).await?.is_some() {
            // A duplicate folder ID must not reveal another user's private item.
            self.require(&tx, &user, id, Role::Viewer).await?;
            return Err(Error::Conflict);
        }
        self.insert_resource(&tx, &user, id, "drive", location, "folder")
            .await?;
        tx.execute(
            "UPDATE aether_access.resources SET folder_name=$3 WHERE tenant=$1 AND id=$2",
            &[&self.tenant(), &id, &name],
        )
        .await
        .map_err(db)?;
        self.audit(&tx, &user, "create_folder", id).await?;
        commit(tx).await
    }
    /// Membership removal also clears old inherited access, so rejoining does
    /// not resurrect a previous share or redeemed link. Default enrollment stays.
    pub async fn set_organization_member(
        &self,
        token: &str,
        organization: &str,
        target: &str,
        role: Option<&str>,
    ) -> Result<()> {
        if !valid_id(organization) || role.is_some_and(|r| !matches!(r, "owner" | "member")) {
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
        Self::admin(&user)?;
        self.active_user(&tx, target).await?;
        self.organization_member_in(&tx, &user, organization, target, role)
            .await?;
        commit(tx).await
    }
    /// Caller has authenticated current administration and holds the ACL lock.
    pub(super) async fn organization_member_in(
        &self,
        tx: &Transaction<'_>,
        actor: &User,
        organization: &str,
        target: &str,
        role: Option<&str>,
    ) -> Result<()> {
        if tx
            .query_opt(
                "SELECT 1 FROM aether_access.organizations WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &organization],
            )
            .await
            .map_err(db)?
            .is_none()
        {
            return Err(Error::Denied);
        }
        if self.member(tx, target, organization).await?.as_deref() == Some("owner")
            && role != Some("owner")
        {
            let count:i64=tx.query_one("SELECT count(*) FROM aether_access.members WHERE tenant=$1 AND organization=$2 AND role='owner'",&[&self.tenant(),&organization]).await.map_err(db)?.get(0);
            if count <= 1 {
                return Err(Error::Conflict);
            }
        }
        tx.execute(
            "INSERT INTO aether_access.enrolled VALUES($1,$2) ON CONFLICT DO NOTHING",
            &[&self.tenant(), &target],
        )
        .await
        .map_err(db)?;
        if let Some(role) = role {
            tx.execute("INSERT INTO aether_access.members VALUES($1,$2,$3,$4) ON CONFLICT(tenant,organization,user_id) DO UPDATE SET role=excluded.role",&[&self.tenant(),&organization,&target,&role]).await.map_err(db)?;
        } else {
            tx.execute("DELETE FROM aether_access.workspace_members m USING aether_access.workspaces w WHERE m.tenant=$1 AND m.user_id=$2 AND w.tenant=m.tenant AND w.id=m.workspace AND w.organization=$3",&[&self.tenant(),&target,&organization]).await.map_err(db)?;
            tx.execute("DELETE FROM aether_access.grants g USING aether_access.resources r WHERE g.tenant=$1 AND g.user_id=$2 AND r.tenant=g.tenant AND r.id=g.resource AND r.organization=$3",&[&self.tenant(),&target,&organization]).await.map_err(db)?;
            tx.execute("DELETE FROM aether_access.link_visits v USING aether_access.links l,aether_access.resources r WHERE v.tenant=$1 AND v.user_id=$2 AND l.tenant=v.tenant AND l.id=v.link AND r.tenant=l.tenant AND r.id=l.resource AND r.organization=$3",&[&self.tenant(),&target,&organization]).await.map_err(db)?;
            tx.execute("DELETE FROM aether_access.members WHERE tenant=$1 AND organization=$2 AND user_id=$3",&[&self.tenant(),&organization,&target]).await.map_err(db)?;
        }
        self.audit(tx, actor, "organization_member", target).await?;
        Ok(())
    }
    /// Replace one team's assignments atomically; bounded lists prevent an
    /// administrative request from holding the ACL lock without a useful limit.
    pub async fn configure_team(
        &self,
        token: &str,
        team: &str,
        members: &[String],
        apps: &[String],
    ) -> Result<()> {
        if !valid_id(team)
            || members.len() > 1000
            || apps.len() > 128
            || members.iter().chain(apps).any(|v| !valid_id(v))
        {
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
        Self::admin(&user)?;
        self.configure_team_in(&tx, team, members, apps).await?;
        self.audit(&tx, &user, "configure_team", team).await?;
        commit(tx).await
    }
    pub(super) async fn configure_team_in(
        &self,
        tx: &Transaction<'_>,
        team: &str,
        members: &[String],
        apps: &[String],
    ) -> Result<()> {
        for member in members {
            self.active_user(tx, member).await?;
        }
        for app in apps {
            if tx
                .query_opt(
                    "SELECT 1 FROM aether_access.applications WHERE tenant=$1 AND id=$2",
                    &[&self.tenant(), &app],
                )
                .await
                .map_err(db)?
                .is_none()
            {
                return Err(Error::Invalid);
            }
        }
        tx.execute(
            "INSERT INTO aether_access.teams(tenant,id) VALUES($1,$2) ON CONFLICT DO NOTHING",
            &[&self.tenant(), &team],
        )
        .await
        .map_err(db)?;
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
        tx.execute("INSERT INTO aether_access.team_members SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",&[&self.tenant(),&team,&members]).await.map_err(db)?;
        tx.execute("INSERT INTO aether_access.team_apps SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",&[&self.tenant(),&team,&apps]).await.map_err(db)?;
        Ok(())
    }
}
