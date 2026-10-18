//! User-delegated credentials. Never accepted by browser session authentication.
//! Protected work and grant checks hold the SAME identity lock/SQL transaction.
use super::*;

const FIELDS: &str = "g.id,g.label,g.apps,g.can_write,g.can_edit_content,extract(epoch FROM g.created)::double precision,extract(epoch FROM g.expires)::double precision,(NOT g.revoked AND g.expires>clock_timestamp())";
#[derive(Serialize, Clone)]
pub struct AgentConnection {
    pub id: String,
    pub label: String,
    pub apps: Vec<String>,
    pub can_write: bool,
    pub can_edit_content: bool,
    pub created: f64,
    pub expires: f64,
    pub active: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AgentConnectionInput {
    pub label: String,
    pub apps: Vec<String>,
    #[serde(default)]
    pub can_write: bool,
    #[serde(default)]
    pub can_edit_content: bool,
    #[serde(default = "default_lifetime")]
    pub lifetime_hours: u32,
}
fn default_lifetime() -> u32 {
    24
}
#[derive(Clone, Copy)]
pub enum AgentAccess {
    Read,
    Write,
    Edit,
}
fn connection(row: &Row) -> AgentConnection {
    AgentConnection {
        id: row.get(0),
        label: row.get(1),
        apps: row.get(2),
        can_write: row.get(3),
        can_edit_content: row.get(4),
        created: row.get(5),
        expires: row.get(6),
        active: row.get(7),
    }
}
impl Identity {
    pub async fn service_connections_in(
        &self,
        tx: &Transaction<'_>,
        session: &str,
    ) -> Result<Vec<AgentConnection>> {
        let user = self.authorize_transaction(tx, session).await?;
        if user.role != Role::Admin {
            return Err(Error::Forbidden);
        }
        Ok(tx.query(&format!("SELECT {FIELDS} FROM aether_identity.agent_connections g WHERE tenant=$1 AND kind='service' ORDER BY created DESC,id LIMIT 1000"), &[&self.tenant]).await.map_err(pg)?.iter().map(connection).collect())
    }
    pub async fn revoke_service_connection(&self, session: &str, id: &str) -> Result<()> {
        if id.is_empty() || id.len() > 128 {
            return Err(Error::InvalidInput);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(pg)?;
        self.lock(&tx).await?;
        let user = self.admin(&tx, session).await?;
        if tx.execute("UPDATE aether_identity.agent_connections SET revoked=true WHERE tenant=$1 AND id=$2 AND kind='service'", &[&self.tenant,&id]).await.map_err(pg)?!=1 { return Err(Error::Forbidden); }
        self.audit(&tx, &user.id, "service_revoked", id).await?;
        commit(tx).await
    }
    /// The caller validates installed/app availability in this same transaction.
    pub async fn create_agent_connection_in(
        &self,
        tx: &Transaction<'_>,
        session: &str,
        input: &AgentConnectionInput,
    ) -> Result<(AgentConnection, Secret)> {
        self.create_connection_in(tx, session, input, false).await
    }
    /// Admin-created service keys retain the creator's current account and ACLs.
    pub async fn create_service_connection_in(
        &self,
        tx: &Transaction<'_>,
        session: &str,
        input: &AgentConnectionInput,
    ) -> Result<(AgentConnection, Secret)> {
        self.create_connection_in(tx, session, input, true).await
    }
    async fn create_connection_in(
        &self,
        tx: &Transaction<'_>,
        session: &str,
        input: &AgentConnectionInput,
        service: bool,
    ) -> Result<(AgentConnection, Secret)> {
        let user = self.authorize_transaction(tx, session).await?;
        if service && user.role != Role::Admin {
            return Err(Error::Forbidden);
        }
        let label = input.label.trim();
        let mut apps = input.apps.clone();
        apps.sort();
        apps.dedup();
        if label.is_empty()
            || label.chars().count() > 80
            || label.chars().any(char::is_control)
            || apps.is_empty()
            || apps.len() > 64
            || apps.len() != input.apps.len()
            || apps.iter().any(|s| {
                s.is_empty()
                    || s.len() > 40
                    || !s
                        .bytes()
                        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
            })
            || !(1..=if service { 8760 } else { 168 }).contains(&input.lifetime_hours)
            || input.can_edit_content && !input.can_write
        {
            return Err(Error::InvalidInput);
        }
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062615))",
            &[&format!("{}:{}", self.tenant, user.id)],
        )
        .await
        .map_err(pg)?;
        let row=tx.query_one("SELECT count(*) FILTER(WHERE NOT revoked AND expires>clock_timestamp()),count(*) FILTER(WHERE created>clock_timestamp()-interval '1 hour') FROM aether_identity.agent_connections WHERE tenant=$1 AND user_id=$2",&[&self.tenant,&user.id]).await.map_err(pg)?;
        if row.get::<_, i64>(0) >= 64 || row.get::<_, i64>(1) >= 20 {
            return Err(Error::Throttled);
        }
        let kind = if service { "service" } else { "agent" };
        let id = format!("{kind}-{}", random_hex::<16>()?);
        let secret = Secret(Zeroizing::new(format!(
            "{}{}",
            if service {
                "aether_sa_"
            } else {
                "aether_agent_"
            },
            random_hex::<32>()?
        )));
        let hash = sha256(secret.expose().as_bytes());
        let hours = f64::from(input.lifetime_hours);
        tx.execute("INSERT INTO aether_identity.agent_connections(tenant,id,user_id,token_hash,label,apps,can_write,can_edit_content,expires,kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()+$9*interval '1 hour',$10)",&[&self.tenant,&id,&user.id,&hash,&label,&apps,&input.can_write,&input.can_edit_content,&hours,&kind]).await.map_err(|e| if e.code()==Some(&tokio_postgres::error::SqlState::UNIQUE_VIOLATION) {Error::Conflict} else {pg(e)})?;
        self.audit(
            tx,
            &user.id,
            if service {
                "service_created"
            } else {
                "agent_connection_created"
            },
            &id,
        )
        .await?;
        let value=connection(&tx.query_one(&format!("SELECT {FIELDS} FROM aether_identity.agent_connections g WHERE tenant=$1 AND id=$2"),&[&self.tenant,&id]).await.map_err(pg)?);
        Ok((value, secret))
    }
    pub async fn agent_connections_in(
        &self,
        tx: &Transaction<'_>,
        session: &str,
    ) -> Result<Vec<AgentConnection>> {
        let user = self.authorize_transaction(tx, session).await?;
        Ok(tx.query(&format!("SELECT {FIELDS} FROM aether_identity.agent_connections g WHERE tenant=$1 AND user_id=$2 AND kind='agent' ORDER BY (NOT revoked AND expires>clock_timestamp()) DESC,created DESC,id LIMIT 128"),&[&self.tenant,&user.id]).await.map_err(pg)?.iter().map(connection).collect())
    }
    pub async fn revoke_agent_connection(&self, session: &str, id: &str) -> Result<()> {
        if id.len() > 128 || id.is_empty() {
            return Err(Error::InvalidInput);
        }
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(pg)?;
        self.lock(&tx).await?;
        let user = self.user(&*tx, session).await?;
        if user.must_change {
            return Err(Error::Forbidden);
        }
        // Unknown and another user's IDs have the same response; never grant admin impersonation.
        if tx.execute("UPDATE aether_identity.agent_connections SET revoked=true WHERE tenant=$1 AND id=$2 AND user_id=$3",&[&self.tenant,&id,&user.id]).await.map_err(pg)?!=1 {return Err(Error::Forbidden);}
        self.audit(&tx, &user.id, "agent_connection_revoked", id)
            .await?;
        commit(tx).await
    }
    pub async fn authorize_agent_transaction(
        &self,
        tx: &Transaction<'_>,
        token: &str,
        app: Option<&str>,
        access: AgentAccess,
    ) -> Result<(User, AgentConnection)> {
        let suffix = token
            .strip_prefix("aether_agent_")
            .or_else(|| token.strip_prefix("aether_sa_"))
            .or_else(|| token.strip_prefix("aether_mcp_"))
            .ok_or(Error::Unauthorized)?;
        if suffix.len() != 64 || !suffix.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(Error::Unauthorized);
        }
        self.read_lock(tx).await?;
        let hash = sha256(token.as_bytes());
        let sql = format!(
            "SELECT {USER_COLUMNS} FROM aether_identity.users u JOIN aether_identity.agent_connections g ON g.tenant=u.tenant AND g.user_id=u.id WHERE u.tenant=$1 AND g.token_hash=$2 AND NOT g.revoked AND g.expires>clock_timestamp() AND u.active AND NOT u.must_change"
        );
        let user = row_user(
            &tx.query_opt(&sql, &[&self.tenant, &hash])
                .await
                .map_err(pg)?
                .ok_or(Error::Unauthorized)?,
        )?;
        let grant=connection(&tx.query_one(&format!("SELECT {FIELDS} FROM aether_identity.agent_connections g WHERE tenant=$1 AND token_hash=$2"),&[&self.tenant,&hash]).await.map_err(pg)?);
        if app.is_some_and(|a| !grant.apps.iter().any(|s| s == a))
            || matches!(access, AgentAccess::Write | AgentAccess::Edit) && !grant.can_write
            || matches!(access, AgentAccess::Edit) && !grant.can_edit_content
        {
            return Err(Error::Forbidden);
        }
        Ok((user, grant))
    }
    /// Revalidate a queued delegation without retaining its bearer secret. Only
    /// trusted server code may use this after authenticating the queue owner.
    pub async fn authorize_agent_id_transaction(
        &self,
        tx: &Transaction<'_>,
        id: &str,
        app: &str,
    ) -> Result<(User, AgentConnection)> {
        self.read_lock(tx).await?;
        let sql = format!(
            "SELECT {USER_COLUMNS} FROM aether_identity.users u JOIN aether_identity.agent_connections g ON g.tenant=u.tenant AND g.user_id=u.id WHERE u.tenant=$1 AND g.id=$2 AND NOT g.revoked AND g.expires>clock_timestamp() AND u.active AND NOT u.must_change"
        );
        let user = row_user(
            &tx.query_opt(&sql, &[&self.tenant, &id])
                .await
                .map_err(pg)?
                .ok_or(Error::Unauthorized)?,
        )?;
        let grant = connection(&tx.query_one(&format!("SELECT {FIELDS} FROM aether_identity.agent_connections g WHERE tenant=$1 AND id=$2"), &[&self.tenant,&id]).await.map_err(pg)?);
        if !grant.apps.iter().any(|a| a == app) || !grant.can_write || !grant.can_edit_content {
            return Err(Error::Forbidden);
        }
        Ok((user, grant))
    }
    pub async fn audit_agent_command_in(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        grant: &AgentConnection,
        command: &str,
    ) -> Result<()> {
        if command.len() > 128
            || !command
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.')
        {
            return Err(Error::InvalidInput);
        }
        self.audit(
            tx,
            &user.id,
            "agent_command",
            &format!("{}:{command}", grant.id),
        )
        .await
    }
}
