use super::*;
use crate::native::network::Configuration;
impl Settings {
    /// Trusted installation startup. Browser reads must authorize separately.
    pub async fn network_snapshot(&self, instance: &str) -> Result<Option<Configuration>> {
        let client = self.client().await?;
        let row = client
            .query_opt(
                "SELECT n.value,p.value->>'name' FROM aether_settings.network n JOIN aether_settings.presentation p ON p.tenant=n.tenant WHERE n.tenant=$1 AND n.instance=$2",
                &[&self.tenant(), &instance],
            )
            .await
            .map_err(db)?;
        row.map(|row| {
            let mut value: serde_json::Value = row.get(0);
            value["name"] = serde_json::json!(
                row.try_get::<_, String>(1)
                    .map_err(|_| Error::Incompatible)?
            );
            serde_json::from_value(value).map_err(|_| Error::Incompatible)
        })
        .transpose()
    }
    pub async fn network_save(
        &self,
        session: &str,
        instance: &str,
        value: &Configuration,
    ) -> Result<()> {
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        deadlines(&tx).await?;
        let actor = self.admin(&tx, session).await?;
        self.lock(&tx).await?;
        let mut current = self.read_in(&tx).await?;
        current.presentation.name = value.name.clone();
        let presentation = Presentation::parse(
            &serde_json::to_vec(&current.presentation).map_err(|_| Error::Invalid)?,
        )
        .map_err(|_| Error::Invalid)?;
        let revision = current.revision.checked_add(1).ok_or(Error::Conflict)?;
        tx.execute(
            "UPDATE aether_settings.presentation SET value=$2,revision=$3 WHERE tenant=$1",
            &[
                &self.tenant(),
                &serde_json::to_value(presentation).map_err(|_| Error::Invalid)?,
                &revision,
            ],
        )
        .await
        .map_err(db)?;
        let mut configuration = serde_json::to_value(value).map_err(|_| Error::Invalid)?;
        configuration
            .as_object_mut()
            .ok_or(Error::Invalid)?
            .remove("name");
        tx.execute("INSERT INTO aether_settings.network(tenant,instance,value) VALUES($1,$2,$3) ON CONFLICT(tenant,instance) DO UPDATE SET value=EXCLUDED.value",&[&self.tenant(),&instance,&configuration]).await.map_err(db)?;
        tx.execute("INSERT INTO aether_settings.audit(tenant,revision,actor,action) VALUES($1,$2,$3,'presentation_updated')",&[&self.tenant(),&revision,&actor]).await.map_err(db)?;
        tx.execute("INSERT INTO aether_identity.audit(tenant,actor,action,target) VALUES($1,$2,'network_settings_saved',$3)",&[&self.tenant(),&actor,&instance]).await.map_err(db)?;
        tx.commit().await.map_err(|_| Error::OutcomeUnknown)
    }
    pub async fn network_restart_requested(&self, session: &str, instance: &str) -> Result<()> {
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        deadlines(&tx).await?;
        let actor = self.admin(&tx, session).await?;
        tx.execute("INSERT INTO aether_identity.audit(tenant,actor,action,target) VALUES($1,$2,'network_restart_requested',$3)",&[&self.tenant(),&actor,&instance]).await.map_err(db)?;
        tx.commit().await.map_err(|_| Error::OutcomeUnknown)
    }
}
