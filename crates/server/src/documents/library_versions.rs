//! Named checkpoints reference canonical revisions; changes are separately audited.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use aether_store::hosted::AuthorizedScope;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio_postgres::{Row, Transaction};

const MAX_VERSIONS: i64 = 1000;
const FIELDS: &str = "v.name,v.revision,v.created,v.message,v.status,v.origin,v.status_updated,v.status_note,v.branch,v.branch_id,(SELECT b.name FROM aether_store.branches b WHERE b.tenant=v.tenant AND b.document_id=v.document_id AND b.id=v.branch_id),v.author";
#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Version,
    VersionUpdate,
    VersionDelete,
    VersionStatus,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub action: Action,
    pub app: String,
    pub id: String,
    pub operation_id: String,
    pub expected_revision: u32,
    pub name: String,
    pub branch: Option<String>,
    pub new_name: Option<String>,
    pub message: Option<String>,
    // Preserve the serialized fingerprints of already-issued checkpoint receipts.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_status_updated: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}
fn name(value: &str) -> Result<&str> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 80 || value.chars().any(char::is_control) {
        return Err(Error::Invalid);
    }
    Ok(value)
}
fn message(value: Option<&str>) -> Result<&str> {
    let value = value.unwrap_or("");
    if value.chars().count() > 500 || value.contains('\0') {
        return Err(Error::Invalid);
    }
    Ok(value.trim())
}
fn value(row: &Row) -> Result<Value> {
    let id: Option<String> = row.get(9);
    let label: String = if id.is_some() {
        row.get::<_, Option<String>>(10)
            .ok_or(Error::Incompatible)?
    } else {
        let label: String = row.get(8);
        if label != "Main" {
            return Err(Error::Incompatible);
        }
        label
    };
    let mut result = json!({"name":row.get::<_,String>(0),"revision":row.get::<_,i64>(1),"created":row.get::<_,f64>(2),"message":row.get::<_,String>(3),"status":row.get::<_,String>(4),"origin":row.get::<_,String>(5),"status_updated":row.get::<_,f64>(6),"status_note":row.get::<_,String>(7),"branch":label});
    if let Some(id) = id {
        result["branch_id"] = json!(id);
    }
    Ok(result)
}
fn insert_error(error: tokio_postgres::Error) -> Error {
    if error.code() == Some(&tokio_postgres::error::SqlState::UNIQUE_VIOLATION) {
        Error::Conflict
    } else {
        db(error)
    }
}
impl Documents {
    pub(super) async fn named_versions(
        &self,
        tx: &Transaction<'_>,
        id: &str,
    ) -> Result<Vec<Value>> {
        let rows = tx.query(&format!("SELECT {FIELDS} FROM aether_access.named_versions v WHERE v.tenant=$1 AND v.document_id=$2 ORDER BY v.created DESC,v.name COLLATE \"C\" LIMIT $3"), &[&self.tenant(), &id, &(MAX_VERSIONS+1)]).await.map_err(db)?;
        if rows.len() > MAX_VERSIONS as usize {
            return Err(Error::Unsupported);
        }
        rows.iter().map(value).collect()
    }
    async fn named_version(
        &self,
        tx: &Transaction<'_>,
        id: &str,
        name: &str,
    ) -> Result<Option<Value>> {
        let row=tx.query_opt(&format!("SELECT {FIELDS} FROM aether_access.named_versions v WHERE v.tenant=$1 AND v.document_id=$2 AND v.name=$3"), &[&self.tenant(), &id, &name]).await.map_err(db)?;
        row.as_ref()
            .map(|row| {
                let mut snapshot = value(row)?;
                snapshot["author"] = json!(row.get::<_, String>(11));
                Ok(snapshot)
            })
            .transpose()
    }

    pub(super) async fn merge_checkpoint(
        &self,
        tx: &Transaction<'_>,
        actor: &aether_identity::User,
        request: &aether_protocol_core::branches::BranchCommand,
        document: &aether_protocol_core::storage::DocumentRevision,
    ) -> Result<()> {
        let aether_protocol_core::branches::BranchChange::Merge { source, target, .. } =
            &request.change
        else {
            return Err(Error::Invalid);
        };
        let heads = self
            .store
            .branch_snapshot_in(
                tx,
                &AuthorizedScope::new(self.tenant(), &actor.id)?,
                &request.document_id,
            )
            .await?;
        let find = |id: &str| {
            heads
                .iter()
                .find(|h| !h.deleted && h.id.as_deref().unwrap_or("Main") == id)
                .ok_or(Error::Incompatible)
        };
        let source = find(source)?;
        let target = find(target)?;
        let count:i64=tx.query_one("SELECT count(*) FROM aether_access.named_versions WHERE tenant=$1 AND document_id=$2",&[&self.tenant(),&request.document_id]).await.map_err(db)?.get(0);
        if count >= MAX_VERSIONS {
            return Err(Error::Unsupported);
        }
        let message = format!("Merged {} into {}", source.name, target.name);
        // A revision makes this deterministic. A user-created identical label
        // gets a bounded suffix; retries never create another checkpoint.
        let base = format!(
            "Merge r{}: {} into {}",
            document.revision, source.name, target.name
        );
        let base: String = base.chars().take(68).collect();
        let mut label = base.clone();
        for suffix in 0..=MAX_VERSIONS {
            if suffix > 0 {
                label = format!("{base} ({suffix})");
            }
            if self
                .named_version(tx, &request.document_id, &label)
                .await?
                .is_none()
            {
                break;
            }
        }
        tx.execute("INSERT INTO aether_access.named_versions VALUES($1,$2,$3,$4,$5,extract(epoch from clock_timestamp())::double precision,$6,'version','automatic',0,'',$7,$8)", &[&self.tenant(),&request.document_id,&label,&i64::from(document.revision),&actor.id,&message,&target.name,&target.id]).await.map_err(insert_error)?;
        let after = self
            .named_version(tx, &request.document_id, &label)
            .await?
            .ok_or(Error::Incompatible)?;
        let receipt =
            json!({"ok":true,"revision":document.revision,"checkpoint":label,"replayed":false});
        let serialized = serde_json::to_value(request).map_err(|_| Error::Invalid)?;
        tx.execute(
            "INSERT INTO aether_access.version_receipts VALUES($1,$2,$3,$4,$5)",
            &[
                &self.tenant(),
                &actor.id,
                &request.operation_id,
                &serialized,
                &receipt,
            ],
        )
        .await
        .map_err(insert_error)?;
        tx.execute("INSERT INTO aether_access.version_events(tenant,actor,operation_id,document_id,before_state,after_state) VALUES($1,$2,$3,$4,'null'::jsonb,$5)",&[&self.tenant(),&actor.id,&request.operation_id,&request.document_id,&after]).await.map_err(db)?;
        self.audit(tx, actor, "branch_merged", &request.document_id)
            .await?;
        Ok(())
    }
    pub async fn change_named_version(&self, token: &str, input: &Request) -> Result<Value> {
        if !valid_id(&input.id) || !valid_id(&input.operation_id) || input.expected_revision == 0 {
            return Err(Error::Invalid);
        }
        let selected = super::library::branch_target(&input.branch)?;
        if (!matches!(input.action, Action::VersionUpdate) && input.new_name.is_some())
            || (matches!(input.action, Action::VersionDelete) && input.message.is_some())
        {
            return Err(Error::Invalid);
        }
        let lifecycle = matches!(input.action, Action::VersionStatus);
        if lifecycle {
            if input.new_name.is_some()
                || input.message.is_some()
                || input.status.is_none()
                || input.expected_status.is_none()
                || !input
                    .expected_status_updated
                    .is_some_and(|v| v.is_finite() && v >= 0.0)
            {
                return Err(Error::Invalid);
            }
        } else if input.status.is_some()
            || input.expected_status.is_some()
            || input.expected_status_updated.is_some()
            || input.note.is_some()
        {
            return Err(Error::Invalid);
        }
        let status_note = message(input.note.as_deref())?;
        let name = name(&input.name)?;
        let msg = message(input.message.as_deref())?;
        let next_name = input
            .new_name
            .as_deref()
            .map(self::name)
            .transpose()?
            .unwrap_or(name);
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        // Exclusive ACL lock orders label changes with saves, revocations and
        // directory operations. No unguarded head read can race a document save.
        let actor = self.begin(&tx, token, true).await?;
        self.app(&tx, &actor, &input.app).await?;
        let resource = self.require(&tx, &actor, &input.id, Role::Editor).await?;
        if resource.kind != "document" || resource.app != input.app {
            return Err(Error::Denied);
        }
        if input.app == "drive" {
            return Err(Error::Unsupported);
        }
        let scope = AuthorizedScope::new(self.tenant(), &actor.id)?;
        let main = self.store.metadata_in(&tx, &scope, &input.id).await?;
        if main.app != input.app {
            return Err(Error::Incompatible);
        }
        let request = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
        if let Some(row) = tx.query_opt("SELECT request,response FROM aether_access.version_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3", &[&self.tenant(), &actor.id, &input.operation_id]).await.map_err(db)? {
            if row.get::<_,Value>(0) != request { return Err(Error::Conflict); }
            let mut response: Value = row.get(1);
            response["replayed"] = json!(true);
            commit(tx).await?;
            return Ok(response);
        }
        let heads = self
            .store
            .branch_snapshot_in(&tx, &scope, &input.id)
            .await?;
        let head = heads
            .iter()
            .find(|h| !h.deleted && h.id.as_deref().unwrap_or("Main") == selected)
            .ok_or(Error::Denied)?;
        if head.head_revision != input.expected_revision {
            return Err(Error::Conflict);
        }
        let before = self.named_version(&tx, &input.id, name).await?;
        let (mut response, event) = match input.action {
            Action::Version => {
                if before.is_some() {
                    return Err(Error::Conflict);
                }
                let count: i64 = tx.query_one("SELECT count(*) FROM aether_access.named_versions WHERE tenant=$1 AND document_id=$2", &[&self.tenant(), &input.id]).await.map_err(db)?.get(0);
                if count >= MAX_VERSIONS {
                    return Err(Error::Unsupported);
                }
                tx.execute("INSERT INTO aether_access.named_versions VALUES($1,$2,$3,$4,$5,extract(epoch from clock_timestamp())::double precision,$6,'version','user',0,'',$7,$8)", &[&self.tenant(), &input.id, &name, &i64::from(head.head_revision), &actor.id, &msg, &head.name, &head.id]).await.map_err(insert_error)?;
                (
                    json!({"ok":true,"revision":head.head_revision}),
                    "version_created",
                )
            }
            Action::VersionStatus => {
                let previous = before.as_ref().ok_or(Error::Denied)?;
                let old_status = previous["status"].as_str().ok_or(Error::Incompatible)?;
                let old_time = previous["status_updated"]
                    .as_f64()
                    .ok_or(Error::Incompatible)?;
                if input.expected_status.as_deref() != Some(old_status)
                    || input.expected_status_updated != Some(old_time)
                {
                    return Err(Error::Conflict);
                }
                let status = input.status.as_deref().ok_or(Error::Invalid)?;
                let allowed = matches!(
                    (old_status, status),
                    ("version", "candidate")
                        | ("candidate", "version" | "released")
                        | ("released", "obsolete")
                );
                if !allowed || (status == "obsolete" && status_note.is_empty()) {
                    return Err(Error::Invalid);
                }
                let now: f64 = tx
                    .query_one(
                        "SELECT extract(epoch from clock_timestamp())::double precision",
                        &[],
                    )
                    .await
                    .map_err(db)?
                    .get(0);
                // Keep the optimistic status token increasing even if the host clock moves backward.
                let updated = now.max(old_time.next_up());
                if !updated.is_finite() {
                    return Err(Error::Incompatible);
                }
                tx.execute("UPDATE aether_access.named_versions SET status=$4,status_updated=$5,status_note=$6 WHERE tenant=$1 AND document_id=$2 AND name=$3", &[&self.tenant(), &input.id, &name, &status, &updated, &status_note]).await.map_err(db)?;
                let event = match status {
                    "candidate" => "version_candidate",
                    "released" => "version_released",
                    "obsolete" => "version_obsolete",
                    _ => "version_version",
                };
                (json!({"ok":true,"status":status}), event)
            }
            Action::VersionUpdate | Action::VersionDelete => {
                let previous = before.as_ref().ok_or(Error::Denied)?;
                if previous["status"] != "version" {
                    return Err(Error::Conflict);
                }
                if matches!(input.action, Action::VersionDelete) {
                    tx.execute("DELETE FROM aether_access.named_versions WHERE tenant=$1 AND document_id=$2 AND name=$3", &[&self.tenant(), &input.id, &name]).await.map_err(db)?;
                    (json!({"ok":true}), "version_deleted")
                } else {
                    let msg = if input.message.is_some() {
                        msg
                    } else {
                        previous["message"].as_str().ok_or(Error::Incompatible)?
                    };
                    tx.execute("UPDATE aether_access.named_versions SET name=$4,message=$5 WHERE tenant=$1 AND document_id=$2 AND name=$3", &[&self.tenant(), &input.id, &name, &next_name, &msg]).await.map_err(insert_error)?;
                    (json!({"ok":true,"name":next_name}), "version_updated")
                }
            }
        };
        let after = if matches!(input.action, Action::VersionDelete) {
            None
        } else {
            self.named_version(&tx, &input.id, next_name).await?
        };
        response["replayed"] = json!(false);
        self.audit(&tx, &actor, event, &input.id).await?;
        tx.execute(
            "INSERT INTO aether_access.version_receipts VALUES($1,$2,$3,$4,$5)",
            &[
                &self.tenant(),
                &actor.id,
                &input.operation_id,
                &request,
                &response,
            ],
        )
        .await
        .map_err(db)?;
        tx.execute("INSERT INTO aether_access.version_events(tenant,actor,operation_id,document_id,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6)", &[&self.tenant(), &actor.id, &input.operation_id, &input.id, &before.unwrap_or(Value::Null), &after.unwrap_or(Value::Null)]).await.map_err(db)?;
        commit(tx).await?;
        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn old_checkpoint_receipt_fingerprints_do_not_gain_new_null_fields() {
        for action in ["version", "version_update", "version_delete"] {
            let original = json!({"action":action,"app":"map","id":"file","operation_id":"old-op","expected_revision":1,"name":"V1","branch":null,"new_name":null,"message":null});
            let request: Request = serde_json::from_value(original.clone()).unwrap();
            assert_eq!(serde_json::to_value(request).unwrap(), original);
        }
    }
}
