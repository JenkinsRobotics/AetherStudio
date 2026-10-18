use super::*;
use aether_store::hosted::AuthorizedScope;
impl Documents {
    pub async fn map_device_show(&self, token: &str) -> Result<Value> {
        let hash = digest(token);
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        tx.batch_execute("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'")
            .await
            .map_err(db)?;
        let owner: String = tx.query_opt("SELECT owner FROM aether_access.map_devices WHERE tenant=$1 AND token_hash=$2 AND owner IS NOT NULL", &[&self.tenant(), &hash]).await.map_err(db)?.ok_or(aether_identity::Error::Unauthorized)?.get(0);
        let user = self
            .identity
            .authorize_service_account_in(&tx, &owner)
            .await?;
        self.map_registry(&tx).await?;
        self.app(&tx, &user, "map").await?;
        let row = tx.query_opt("UPDATE aether_access.map_devices SET seen=clock_timestamp() WHERE tenant=$1 AND token_hash=$2 AND owner=$3 RETURNING id,document", &[&self.tenant(), &hash, &owner]).await.map_err(db)?.ok_or(aether_identity::Error::Unauthorized)?;
        let id: String = row.get(0);
        let document: Option<String> = row.get(1);
        let mut result = json!({"device":id,"show":null});
        if let Some(document) = document {
            match self.map_show_resource(&tx, &user, &document).await {
                Ok(()) => {
                    let stored = self
                        .store
                        .read_in(
                            &tx,
                            &AuthorizedScope::new(self.tenant(), &user.id)?,
                            &document,
                            None,
                        )
                        .await?;
                    result["show"] = json!({"id":document,"name":stored.document.name,"revision":stored.document.revision,"layout_base64":stored.content_base64});
                }
                Err(Error::Denied) => {} // Existing player interprets null as stop/clear.
                Err(error) => return Err(error),
            }
        }
        commit(tx).await?;
        Ok(result)
    }
}

impl Documents {
    pub async fn map_device_media(
        &self,
        token: &str,
        name: &str,
    ) -> Result<super::super::download::Content> {
        if super::super::map_media::mime(name).is_none() {
            return Err(Error::Invalid);
        }
        let hash = digest(token);
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        tx.batch_execute("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'")
            .await
            .map_err(db)?;
        let owner:String = tx.query_opt("SELECT owner FROM aether_access.map_devices WHERE tenant=$1 AND token_hash=$2 AND owner IS NOT NULL", &[&self.tenant(), &hash]).await.map_err(db)?.ok_or(aether_identity::Error::Unauthorized)?.get(0);
        let user = self
            .identity
            .authorize_service_account_in(&tx, &owner)
            .await?;
        self.map_registry(&tx).await?;
        self.app(&tx, &user, "map").await?;
        let row = tx.query_opt("SELECT document FROM aether_access.map_devices WHERE tenant=$1 AND token_hash=$2 AND owner=$3", &[&self.tenant(), &hash, &owner]).await.map_err(db)?.ok_or(aether_identity::Error::Unauthorized)?;
        let document: String = row.get::<_, Option<String>>(0).ok_or(Error::Denied)?;
        self.map_show_resource(&tx, &user, &document).await?;
        let stored = self
            .store
            .read_in(
                &tx,
                &AuthorizedScope::new(self.tenant(), &user.id)?,
                &document,
                None,
            )
            .await?;
        if !super::super::map_media::references(&stored.content_base64)?.contains(name) {
            return Err(Error::Denied);
        }
        // A saved reference must have passed the same atomic binding as browser saves.
        if tx.query_opt("SELECT 1 FROM aether_access.map_media_refs WHERE tenant=$1 AND document=$2 AND name=$3", &[&self.tenant(), &document, &name]).await.map_err(db)?.is_none() { return Err(Error::Denied); }
        let content = self.map_media_content(&tx, &user, name).await?;
        commit(tx).await?;
        Ok(content)
    }
}
