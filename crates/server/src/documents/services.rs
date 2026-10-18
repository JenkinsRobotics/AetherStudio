use super::{Documents, Error, Result, commit, db};
use aether_identity::automation::{AgentAccess, AgentConnectionInput};
use serde_json::{Value, json};
impl Documents {
    pub async fn services(
        &self,
        session: &str,
        input: Option<&AgentConnectionInput>,
    ) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, session, false).await?;
        if user.role != aether_identity::Role::Admin {
            return Err(aether_identity::Error::Forbidden.into());
        }
        let result = if let Some(input) = input {
            let apps = self
                .allowed_apps(&tx, &user, super::automation::APPS)
                .await?;
            if input.apps.iter().any(|app| !apps.contains(app)) {
                return Err(Error::Invalid);
            }
            let (connection, secret) = self
                .identity
                .create_service_connection_in(&tx, session, input)
                .await?;
            json!({"ok":true,"id":connection.id,"token":secret.expose()})
        } else {
            json!(self.identity.service_connections_in(&tx,session).await?.into_iter().map(|g|json!({"id":g.id,"name":g.label,"apps":g.apps,"expires":g.expires,"active":g.active,"can_write":g.can_write,"can_edit_content":g.can_edit_content})).collect::<Vec<_>>())
        };
        commit(tx).await?;
        Ok(result)
    }
    /// Only the isolated application RPC runtime may use this check. Service
    /// credentials are not accepted by browser document/identity/admin routes.
    pub async fn service_application_access(&self, key: &str, app: &str) -> Result<()> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let (user, _) = self
            .identity
            .authorize_agent_transaction(&tx, key, Some(app), AgentAccess::Write)
            .await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        if !self
            .allowed_apps(&tx, &user, &[app])
            .await?
            .iter()
            .any(|id| id == app)
        {
            return Err(aether_identity::Error::Forbidden.into());
        }
        commit(tx).await
    }
}
