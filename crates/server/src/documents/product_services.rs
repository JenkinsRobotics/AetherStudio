//! Stateless product browser computations. SQL authority is never held during engine work.
use super::{Documents, Error, Result};
use serde_json::Value;
impl Documents {
    pub(crate) fn cad_browser_configured(&self) -> bool {
        self.products
            .as_ref()
            .is_some_and(|p| p.cad_browser_configured())
    }
    async fn authorize_product_service(&self, token: &str, app: &str) -> Result<()> {
        let (status, apps) = self.application_status(Some(token), &[app]).await?;
        if status.user.is_none() {
            return Err(aether_identity::Error::Unauthorized.into());
        }
        if !apps.iter().any(|a| a == app) {
            return Err(aether_identity::Error::Forbidden.into());
        }
        Ok(())
    }
    pub async fn product_service(
        &self,
        token: &str,
        app: &str,
        path: &str,
        arguments: &Value,
    ) -> Result<Value> {
        self.authorize_product_service(token, app).await?;
        if !path.starts_with(&format!("/api/{app}/")) {
            return Err(Error::Invalid);
        }
        let result = self
            .products
            .as_ref()
            .ok_or(Error::Unavailable)?
            .service(path, arguments)
            .await;
        // An account/app restriction changed during evaluation must also suppress results/errors.
        self.authorize_product_service(token, app).await?;
        result
    }
}
