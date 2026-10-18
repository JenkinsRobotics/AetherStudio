use super::{Documents, Error, Result, commit, db, valid_id};
use aether_identity::SessionStatus;

impl Documents {
    /// One identity/ACL snapshot for status. No lazy membership enrollment,
    /// writes, caller-supplied user IDs or administrator impersonation.
    pub async fn application_status(
        &self,
        token: Option<&str>,
        candidates: &[&str],
    ) -> Result<(SessionStatus, Vec<String>)> {
        if candidates.len() > 64 || candidates.iter().any(|id| !valid_id(id)) {
            return Err(Error::Invalid);
        }
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let status = self.identity.session_status_in(&tx, token).await?;
        let mut allowed = Vec::new();
        if let Some(user) = status.user.as_ref().filter(|u| !u.must_change) {
            tx.execute(
                "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
                &[&self.tenant()],
            )
            .await
            .map_err(db)?;
            // One permission query for the whole catalog, under the same
            // identity/ACL locks as before. Preserve caller ordering and keep
            // disabled apps denied even for server administrators.
            let ids = self.allowed_apps(&tx, user, candidates).await?;
            allowed.extend(
                candidates
                    .iter()
                    .filter(|app| ids.iter().any(|id| id == **app))
                    .map(|app| (*app).to_owned()),
            );
        }
        commit(tx).await?;
        Ok((status, allowed))
    }
}
