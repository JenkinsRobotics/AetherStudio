use super::*;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BackupChange {
    pub interval_hours: i32,
    #[serde(default)]
    pub export_directory: String,
}
impl Settings {
    pub async fn backup_change(&self, session: &str, change: &BackupChange) -> Result<()> {
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        deadlines(&tx).await?;
        let actor = self.admin(&tx, session).await?;
        if !matches!(change.interval_hours, 0 | 6 | 12 | 24 | 168)
            || !change.export_directory.is_empty()
        {
            return Err(Error::Invalid);
        }
        self.lock(&tx).await?;
        tx.execute("INSERT INTO aether_settings.backups(tenant,interval_hours) VALUES($1,$2) ON CONFLICT(tenant) DO UPDATE SET interval_hours=EXCLUDED.interval_hours",&[&self.tenant(),&change.interval_hours]).await.map_err(db)?;
        // Presentation audit revisions are unrelated to backup policy. Use the
        // common identity audit, shown by the existing administrator activity UI.
        tx.execute("INSERT INTO aether_identity.audit(tenant,actor,action,target) VALUES($1,$2,'backup_schedule_changed','')",&[&self.tenant(),&actor]).await.map_err(db)?;
        tx.commit().await.map_err(|_| Error::OutcomeUnknown)
    }
}
