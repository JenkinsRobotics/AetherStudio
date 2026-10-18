//! Product semantics run outside SQL locks. Both sides of the worker call obtain
//! fresh authority; content, audit and retry receipts commit atomically.
use super::automation::{Delegation, Run, random_id};
use super::{AuthorizedScope, DocumentChange, Documents, Error, Mutation, Result, commit, db};
use crate::products::{MAX_CONTENT, Product, validate_arguments};
use aether_identity::automation::AgentAccess;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use zeroize::Zeroizing;

impl Documents {
    pub(super) async fn product_command(
        &self,
        token: Zeroizing<String>,
        input: Run,
        product: Product,
    ) -> Result<Value> {
        validate_arguments(&input.arguments, &product.descriptor.input_schema)?;
        let id = input.arguments["id"]
            .as_str()
            .filter(|s| super::valid_id(s))
            .ok_or(Error::Invalid)?;
        if input.arguments["app"] != product.app {
            return Err(Error::Invalid);
        }
        let writes = product.descriptor.writes;
        let expected = if writes {
            Some(
                input.arguments["expected_revision"]
                    .as_u64()
                    .and_then(|n| u32::try_from(n).ok())
                    .filter(|n| *n > 0)
                    .ok_or(Error::Invalid)?,
            )
        } else {
            None
        };
        let operation = match &input.operation_id {
            Some(id) if writes && super::valid_id(id) => id.clone(),
            Some(_) => return Err(Error::Invalid),
            None => random_id()?,
        };
        let fingerprint = format!(
            "{:x}",
            Sha256::digest(
                serde_json::to_vec(&json!([input.id, input.arguments]))
                    .map_err(|_| Error::Invalid)?
            )
        );
        let mut delegated = self.clone();
        delegated.delegation = Some(Delegation {
            token: Arc::new(token),
            app: product.app.clone(),
            document: Some(id.to_owned()),
            access: if writes {
                AgentAccess::Edit
            } else {
                AgentAccess::Read
            },
            command: input.id.clone(),
        });
        let (source, metadata) = {
            let mut c = delegated.client().await?;
            let tx = c
                .build_transaction()
                .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
                .start()
                .await
                .map_err(db)?;
            let user = delegated.begin(&tx, "", false).await?;
            if writes
                && let Some(result) = delegated
                    .product_receipt(&tx, &user.id, &operation, &fingerprint, id)
                    .await?
            {
                commit(tx).await?;
                return Ok(result);
            }
            let saved = delegated
                .store
                .read_in(
                    &tx,
                    &AuthorizedScope::new(delegated.tenant(), &user.id)?,
                    id,
                    None,
                )
                .await?;
            if saved.document.app != product.app {
                return Err(Error::Denied);
            }
            if expected.is_some_and(|n| n != saved.document.revision) {
                return Err(Error::Conflict);
            }
            if saved.document.size_bytes as usize > MAX_CONTENT {
                return Err(Error::TooLarge);
            }
            let bytes = STANDARD
                .decode(saved.content_base64)
                .map_err(|_| Error::Incompatible)?;
            let metadata = delegated
                .library_metadata(&tx, &user, &saved.document)
                .await?;
            commit(tx).await?;
            (bytes, metadata)
        };
        // No borrowed SQL connection, ACL lock or session permit survives this await.
        let response = self
            .products
            .as_ref()
            .ok_or(Error::Unavailable)?
            .execute_bytes(&product, &source, &input.arguments)
            .await?;
        let mut c = delegated.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = delegated.begin(&tx, "", false).await?;
        if writes
            && let Some(result) = delegated
                .product_receipt(&tx, &user.id, &operation, &fingerprint, id)
                .await?
        {
            commit(tx).await?;
            return Ok(result);
        }
        let changed = response.get("content").is_some();
        let metadata = if let Some(expected_revision) = expected.filter(|_| changed) {
            let internal = format!(
                "product-{:x}",
                Sha256::digest(
                    serde_json::to_vec(&json!([delegated.tenant(), user.id, operation]))
                        .map_err(|_| Error::Invalid)?
                )
            );
            let receipt = delegated
                .mutate_in(
                    &tx,
                    &user,
                    &Mutation {
                        operation_id: internal,
                        document_id: id.into(),
                        location: None,
                        change: DocumentChange::Save {
                            expected_revision,
                            content_base64: STANDARD.encode(product.decode_content(
                                response["content"].as_str().ok_or(Error::Invalid)?,
                            )?),
                        },
                    },
                    Some(&product.app),
                )
                .await?;
            delegated
                .library_metadata(&tx, &user, &receipt.document)
                .await?
        } else if let Some(expected_revision) = expected {
            // A validated no-op must still guard the current head and record
            // its receipt, without fabricating a new document revision.
            let saved = delegated
                .store
                .read_in(
                    &tx,
                    &AuthorizedScope::new(delegated.tenant(), &user.id)?,
                    id,
                    None,
                )
                .await?;
            if saved.document.revision != expected_revision {
                return Err(Error::Conflict);
            }
            delegated
                .library_metadata(&tx, &user, &saved.document)
                .await?
        } else {
            metadata
        };
        let mut result = response["result"].clone();
        result["document"] = metadata;
        result["saved_state_only"] = json!(true);
        result["changed"] = json!(changed);
        if writes {
            result["replayed"] = json!(false);
        }
        let result = json!({"command":input.id,"result":result});
        if writes {
            tx.execute("INSERT INTO aether_access.automation_receipts(tenant,actor,operation_id,fingerprint,document_id,response) VALUES($1,$2,$3,$4,$5,$6)",&[&delegated.tenant(),&user.id,&operation,&fingerprint,&id,&result]).await.map_err(db)?;
        }
        commit(tx).await?;
        Ok(result)
    }
    pub(super) async fn product_receipt(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        actor: &str,
        operation: &str,
        fingerprint: &str,
        id: &str,
    ) -> Result<Option<Value>> {
        let key = serde_json::to_string(&json!([self.tenant(), actor, operation]))
            .map_err(|_| Error::Invalid)?;
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062616))",
            &[&key],
        )
        .await
        .map_err(db)?;
        let row=tx.query_opt("SELECT fingerprint,document_id,response FROM aether_access.automation_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3",&[&self.tenant(),&actor,&operation]).await.map_err(db)?;
        if let Some(row) = row {
            if row.get::<_, String>(0) != fingerprint || row.get::<_, String>(1) != id {
                return Err(Error::Conflict);
            }
            let mut value: Value = row.get(2);
            value["result"]["replayed"] = json!(true);
            return Ok(Some(value));
        }
        Ok(None)
    }
}
