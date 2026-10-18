//! Read-only login readiness and optional session projection. This is not an
//! authorization grant; services must hold the transaction while using its user.
use super::*;

#[derive(Debug, Serialize)]
pub struct SessionStatus {
    pub ready: bool,
    pub user: Option<User>,
    pub preferences: Option<Preferences>,
}

impl SessionStatus {
    pub fn display_user(self) -> Option<DisplayUser> {
        self.user
            .zip(self.preferences)
            .map(|(account, preferences)| DisplayUser {
                account,
                preferences,
            })
    }
}

impl Identity {
    pub async fn session_status(&self, token: Option<&str>) -> Result<SessionStatus> {
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        let result = self.session_status_in(&tx, token).await?;
        commit(tx).await?;
        Ok(result)
    }

    /// Also allows forced-password sessions to describe their own account, but
    /// never grants them application access. Invalidated sessions become anonymous;
    /// database failures remain errors, not a false sign-out or setup prompt.
    pub async fn session_status_in(
        &self,
        tx: &Transaction<'_>,
        token: Option<&str>,
    ) -> Result<SessionStatus> {
        self.read_lock(tx).await?;
        let ready: bool = tx
            .query_one(
                "SELECT EXISTS(SELECT 1 FROM aether_identity.users WHERE tenant=$1)",
                &[&self.tenant],
            )
            .await
            .map_err(pg)?
            .get(0);
        let user = if let Some(token) = token {
            match self.user(tx, token).await {
                Ok(user) => Some(user),
                Err(Error::Unauthorized) => None,
                Err(error) => return Err(error),
            }
        } else {
            None
        };
        let preferences = if let Some(user) = &user {
            Some(self.preferences_in(tx, &user.id).await?)
        } else {
            None
        };
        Ok(SessionStatus {
            ready,
            user,
            preferences,
        })
    }
}
