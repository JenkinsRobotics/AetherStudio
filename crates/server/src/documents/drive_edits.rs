//! Drive commands reuse structural/content authorities and their transaction receipts.
use super::{Documents, Error, Location, Mutation, Result, Role, commit, db, valid_id};
use aether_protocol_core::storage::DocumentChange;
use aether_store::hosted::AuthorizedScope;
use serde::Deserialize;
use serde_json::{Value, json};
use std::time::Duration;
use tokio_postgres::Transaction;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RenameRequest {
    pub id: String,
    pub operation_id: String,
    pub kind: String,
    pub name: String,
    pub expected_revision: u32,
}
impl Documents {
    /// The original Drive collision rule is ASCII case-insensitive, matching
    /// SQLite's built-in lower(). This checks identities, never overwrites files.
    pub(super) async fn drive_name_available(
        &self,
        tx: &Transaction<'_>,
        exclude: &str,
        name: &str,
        location: &Location,
        owner: &str,
    ) -> Result<()> {
        let conflict:bool=tx.query_one(r#"SELECT EXISTS(
 SELECT 1 FROM aether_access.resources r
 LEFT JOIN aether_store.documents d ON d.tenant=r.tenant AND d.id=r.id
 LEFT JOIN aether_store.revisions v ON v.tenant=d.tenant AND v.document_id=d.id AND v.revision=d.head_revision
 WHERE r.tenant=$1 AND r.id<>$2 AND NOT r.trashed AND r.organization=$3
 AND r.workspace IS NOT DISTINCT FROM $4 AND r.parent IS NOT DISTINCT FROM $5
 AND ($4::text IS NOT NULL OR $5::text IS NOT NULL OR r.owner=$6)
 AND translate(CASE WHEN r.kind='folder' THEN r.folder_name ELSE v.metadata->>'name' END,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')=translate($7,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')
)"#,&[&self.tenant(),&exclude,&location.organization,&location.workspace,&location.parent,&owner,&name]).await.map_err(db)?.get(0);
        if conflict {
            Err(Error::Conflict)
        } else {
            Ok(())
        }
    }
    pub async fn drive_rename_file(&self, token: &str, input: &RenameRequest) -> Result<Value> {
        if input.kind != "file"
            || !valid_id(&input.id)
            || !valid_id(&input.operation_id)
            || input.expected_revision == 0
        {
            return Err(Error::Invalid);
        }
        let name = input.name.trim();
        if name.is_empty() || name.len() > 1024 || name.chars().any(char::is_control) {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(
            Duration::from_secs(20),
            self.drive_rename_file_inner(token, input, name),
        )
        .await
        .map_err(|_| Error::OutcomeUnknown)?
    }
    async fn drive_rename_file_inner(
        &self,
        token: &str,
        input: &RenameRequest,
        name: &str,
    ) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.identity.authorize_transaction(&tx, token).await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        self.app(&tx, &user, "drive").await?;
        let resource = self.require(&tx, &user, &input.id, Role::Editor).await?;
        self.app(&tx, &user, &resource.app).await?;
        if resource.kind != "document" {
            return Err(Error::Denied);
        }
        let head = self
            .store
            .metadata_in(
                &tx,
                &AuthorizedScope::new(self.tenant(), &user.id)?,
                &input.id,
            )
            .await?;
        // An older guard can only replay an exact stored receipt or be rejected.
        // A later sibling name must not prevent acknowledgement of that receipt.
        if head.revision == input.expected_revision {
            self.drive_name_available(&tx, &input.id, name, &resource.location, &resource.owner)
                .await?;
        }
        let receipt = self
            .mutate_in(
                &tx,
                &user,
                &Mutation {
                    operation_id: input.operation_id.clone(),
                    document_id: input.id.clone(),
                    location: None,
                    change: DocumentChange::Rename {
                        expected_revision: input.expected_revision,
                        name: name.into(),
                    },
                },
                Some(&resource.app),
            )
            .await?;
        let mut descriptor_bytes = 0;
        let mut result = self
            .drive_entry(&tx, &user, &input.id, &mut descriptor_bytes)
            .await?;
        result["operation_id"] = json!(receipt.document.operation_id);
        result["replayed"] = json!(receipt.replayed);
        commit(tx).await?;
        Ok(result)
    }
}
