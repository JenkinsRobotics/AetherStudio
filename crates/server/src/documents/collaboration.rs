//! Studio collaboration uses its own revision, item journal and operation receipts.
use super::collaboration_model::{self as model, Edit, MAX_STATE_BYTES};
pub use super::collaboration_model::{Collection, Operation};
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use aether_identity::User;
use aether_store::hosted::AuthorizedScope;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};
use tokio_postgres::Transaction;

#[derive(Deserialize, Serialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Collaboration {
        app: String,
        id: String,
        branch: Option<String>,
        operation_id: Option<String>,
    },
    CollaborationMutate {
        app: String,
        id: String,
        branch: Option<String>,
        operation_id: String,
        expected_revision: u32,
        collection: Collection,
        operation: Operation,
        item: Option<String>,
        #[serde(default)]
        value: Map<String, Value>,
    },
}
struct State {
    revision: u32,
    content: Value,
}
impl Documents {
    async fn collaboration_state(&self, tx: &Transaction<'_>, id: &str) -> Result<State> {
        let revision=tx.query_opt("SELECT revision FROM aether_access.collaboration_heads WHERE tenant=$1 AND document_id=$2",&[&self.tenant(),&id]).await.map_err(db)?.map_or(0,|r|r.get::<_,i64>(0)) as u32;
        let bounds=tx.query_one("SELECT count(*),coalesce(sum(octet_length(value::text)),0)::bigint FROM aether_access.collaboration_items WHERE tenant=$1 AND document_id=$2",&[&self.tenant(),&id]).await.map_err(db)?;
        if bounds.get::<_, i64>(0) > 15001 || bounds.get::<_, i64>(1) > MAX_STATE_BYTES as i64 {
            return Err(Error::Unsupported);
        }
        let mut content = json!({"comments":[],"tasks":[],"reminders":[],"notes":{"text":""}});
        for row in tx.query("SELECT collection,item_id,position,value FROM aether_access.collaboration_items WHERE tenant=$1 AND document_id=$2 ORDER BY collection,position",&[&self.tenant(),&id]).await.map_err(db)? {
   let collection:&str=row.get(0);let item:&str=row.get(1);let position:i32=row.get(2);let value:Value=row.get(3);
   if !value.is_object()||!value["text"].is_string(){return Err(Error::Incompatible)}
   if collection=="notes" {if item!="notes"||position!=0{return Err(Error::Incompatible)}content["notes"]=value;}
   else {let items=content.get_mut(collection).and_then(Value::as_array_mut).ok_or(Error::Incompatible)?;
    if value["id"]!=item||!value["author"].is_string()||items.len()!=position as usize{return Err(Error::Incompatible)}items.push(value);
   }
  }
        Ok(State { revision, content })
    }
    async fn collaboration_members(
        &self,
        tx: &Transaction<'_>,
        actor: &User,
        id: &str,
        organization: &str,
    ) -> Result<Vec<Value>> {
        let rows=tx.query("SELECT u.id,coalesce(nullif(u.full_name,''),u.username) FROM aether_identity.users u JOIN aether_access.members m ON m.tenant=u.tenant AND m.user_id=u.id WHERE u.tenant=$1 AND m.organization=$2 AND u.active ORDER BY u.username COLLATE \"C\" LIMIT 2049",&[&self.tenant(),&organization]).await.map_err(db)?;
        if rows.len() > 2048 {
            return Err(Error::Unsupported);
        }
        let mut members = Vec::new();
        let mut bytes = 0;
        for row in rows {
            let candidate_id: String = row.get(0);
            // Resource policy uses this candidate ID only; this never creates an authenticated session.
            let candidate = User {
                id: candidate_id.clone(),
                ..actor.clone()
            };
            match self.require(tx, &candidate, id, Role::Viewer).await {
                Ok(_) => (),
                Err(Error::Denied) => continue,
                Err(e) => return Err(e),
            }
            let avatar = tx
                .query_opt(
                    "SELECT avatar FROM aether_identity.preferences WHERE tenant=$1 AND user_id=$2",
                    &[&self.tenant(), &candidate_id],
                )
                .await
                .map_err(db)?
                .map_or_else(String::new, |r| r.get(0));
            let member = json!({"id":candidate_id,"name":row.get::<_,String>(1),"avatar":avatar});
            bytes += serde_json::to_vec(&member)
                .map_err(|_| Error::Incompatible)?
                .len();
            if bytes > 4 * 1024 * 1024 {
                return Err(Error::Unsupported);
            }
            members.push(member);
        }
        Ok(members)
    }
    async fn collaboration_response(
        &self,
        tx: &Transaction<'_>,
        actor: &User,
        id: &str,
        owner: &str,
        state: State,
        members: Vec<Value>,
    ) -> Result<Value> {
        let activity:Vec<Value>=tx.query("SELECT e.revision,e.created,e.collection,e.operation,e.item_id,coalesce(nullif(u.full_name,''),u.username) FROM aether_access.collaboration_events e JOIN aether_identity.users u ON u.tenant=e.tenant AND u.id=e.actor WHERE e.tenant=$1 AND e.document_id=$2 ORDER BY e.revision DESC LIMIT 100",&[&self.tenant(),&id]).await.map_err(db)?.into_iter().map(|r|json!({"revision":r.get::<_,i64>(0),"created":r.get::<_,f64>(1),"collection":r.get::<_,String>(2),"operation":r.get::<_,String>(3),"item":r.get::<_,String>(4),"author":r.get::<_,String>(5)})).collect();
        if activity
            .first()
            .and_then(|v| v["revision"].as_u64())
            .unwrap_or(0)
            != u64::from(state.revision)
        {
            return Err(Error::Incompatible);
        }
        let mut response = state.content;
        response["revision"] = json!(state.revision);
        response["mutation_replay"] = json!("operation_id");
        response["actor"] = json!(actor.id);
        response["owner"] = json!(owner);
        response["members"] = json!(members);
        response["activity"] = json!(activity);
        Ok(response)
    }
    pub async fn collaboration(&self, token: &str, input: &Request) -> Result<Value> {
        let (app, id, branch, op) = match input {
            Request::Collaboration {
                app,
                id,
                branch,
                operation_id,
            } => (app, id, branch, operation_id.as_deref()),
            Request::CollaborationMutate {
                app,
                id,
                branch,
                operation_id,
                ..
            } => (app, id, branch, Some(operation_id.as_str())),
        };
        if !valid_id(id) || op.is_some_and(|v| !valid_id(v)) {
            return Err(Error::Invalid);
        }
        let selected = super::library::branch_target(branch)?;
        let writing = matches!(input, Request::CollaborationMutate { .. });
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let actor = self.begin(&tx, token, writing).await?;
        self.app(&tx, &actor, app).await?;
        let resource = self.require(&tx, &actor, id, Role::Viewer).await?;
        if resource.kind != "document" || resource.app != *app {
            return Err(Error::Denied);
        }
        let scope = AuthorizedScope::new(self.tenant(), &actor.id)?;
        if self.store.metadata_in(&tx, &scope, id).await?.app != *app {
            return Err(Error::Denied);
        }
        let heads = self.store.branch_snapshot_in(&tx, &scope, id).await?;
        let active = heads
            .iter()
            .any(|h| !h.deleted && h.id.as_deref().unwrap_or("Main") == selected);
        if !writing && !active {
            return Err(Error::Invalid);
        }
        let editor = match self.require(&tx, &actor, id, Role::Editor).await {
            Ok(_) => true,
            Err(Error::Denied) => false,
            Err(e) => return Err(e),
        };
        let members = self
            .collaboration_members(&tx, &actor, id, &resource.location.organization)
            .await?;
        let mut state = self.collaboration_state(&tx, id).await?;
        let mut replay = None;
        if let Request::CollaborationMutate {
            operation_id,
            expected_revision,
            collection,
            operation,
            item,
            value,
            ..
        } = input
        {
            let request = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
            let receipt=tx.query_opt("SELECT request,applied_revision,editor_required FROM aether_access.collaboration_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3",&[&self.tenant(),&actor.id,operation_id]).await.map_err(db)?;
            if let Some(receipt) = receipt {
                if receipt.get::<_, Value>(0) != request {
                    return Err(Error::Conflict);
                }
                if receipt.get::<_, bool>(2) && !editor {
                    return Err(model::forbidden());
                }
                replay = Some((receipt.get::<_, i64>(1), true));
            } else {
                if !active {
                    return Err(Error::Invalid);
                }
                if state.revision != *expected_revision {
                    return Err(Error::Conflict);
                }
                let revision = state.revision.checked_add(1).ok_or(Error::Unsupported)?;
                let key = collection.key();
                let action = operation.key();
                let mut item_id = item.clone().unwrap_or_default();
                let mut position = 0i32;
                let before = if *collection == Collection::Notes {
                    item_id = "notes".into();
                    Some(state.content["notes"].clone())
                } else {
                    let items = state.content[key].as_array().ok_or(Error::Incompatible)?;
                    if *operation == Operation::Add {
                        if !item_id.is_empty() {
                            return Err(Error::Invalid);
                        }
                        if items.len() >= 5000 {
                            return Err(Error::Unsupported);
                        }
                        position = items.len() as i32;
                        item_id = format!(
                            "{:x}",
                            Sha256::digest(
                                serde_json::to_vec(&(self.tenant(), &actor.id, id, operation_id))
                                    .map_err(|_| Error::Invalid)?
                            )
                        )[..32]
                            .into();
                        None
                    } else {
                        if !valid_id(&item_id) {
                            return Err(Error::Invalid);
                        }
                        let (index, old) = items
                            .iter()
                            .enumerate()
                            .find(|(_, v)| v["id"] == item_id && v["deleted"] != true)
                            .ok_or(Error::Denied)?;
                        position = index as i32;
                        Some(old.clone())
                    }
                };
                let mut parent = None;
                let mut reference_name = None;
                if *collection == Collection::Comments {
                    if let Some(p) = value
                        .get("parent")
                        .filter(|p| !p.is_null() && p.as_str() != Some(""))
                    {
                        let p = p.as_str().ok_or(Error::Invalid)?;
                        parent = Some(
                            state.content["comments"]
                                .as_array()
                                .ok_or(Error::Incompatible)?
                                .iter()
                                .find(|v| {
                                    v["id"] == p && v["parent"].is_null() && v["deleted"] != true
                                })
                                .ok_or(Error::Invalid)?
                                .clone(),
                        );
                    }
                    if let Some(r) = value.get("revision").filter(|v| !v.is_null()) {
                        let revision = r
                            .as_u64()
                            .filter(|r| *r > 0 && *r <= u64::from(u32::MAX))
                            .ok_or(Error::Invalid)? as i64;
                        if tx.query_opt("SELECT 1 FROM aether_store.revisions WHERE tenant=$1 AND document_id=$2 AND revision=$3",&[&self.tenant(),id,&revision]).await.map_err(db)?.is_none(){return Err(Error::Invalid)}
                        reference_name=tx.query_opt("SELECT name FROM aether_access.named_versions WHERE tenant=$1 AND document_id=$2 AND revision=$3 ORDER BY created DESC,name COLLATE \"C\" LIMIT 1",&[&self.tenant(),id,&revision]).await.map_err(db)?.map(|r|r.get::<_,String>(0));
                    }
                }
                let mut comment_branch = heads
                    .iter()
                    .find(|h| h.id.is_none())
                    .ok_or(Error::Incompatible)?;
                if *collection == Collection::Comments && *operation == Operation::Add {
                    let explicit = value
                        .get("branch")
                        .map(|v| v.as_str().map(str::to_owned).ok_or(Error::Invalid))
                        .transpose()?;
                    if explicit.is_some() {
                        super::library::branch_target(&explicit)?;
                    }
                    let target = if let Some(parent) = &parent {
                        let inherited = parent["branch_id"].as_str().unwrap_or("Main");
                        if explicit.as_deref().is_some_and(|v| v != inherited) {
                            return Err(Error::Invalid);
                        }
                        inherited
                    } else {
                        explicit.as_deref().unwrap_or(selected)
                    };
                    comment_branch = heads
                        .iter()
                        .find(|h| {
                            h.id.as_deref().unwrap_or("Main") == target
                                && (parent.is_some() || !h.deleted)
                        })
                        .ok_or(Error::Invalid)?;
                }
                let now: f64 = tx
                    .query_one(
                        "SELECT extract(epoch from clock_timestamp())::double precision",
                        &[],
                    )
                    .await
                    .map_err(db)?
                    .get(0);
                let assignees: Vec<String> = members
                    .iter()
                    .filter_map(|v| v["id"].as_str().map(str::to_owned))
                    .collect();
                let (after, editor_required) = model::edit(Edit {
                    collection: *collection,
                    operation: *operation,
                    patch: value,
                    before: before.as_ref(),
                    actor: &actor.id,
                    editor,
                    id: &item_id,
                    now,
                    parent: parent.as_ref(),
                    reference_name: reference_name.as_deref(),
                    branch_name: &comment_branch.name,
                    branch_id: comment_branch.id.as_deref(),
                    assignees: &assignees,
                })?;
                if *collection == Collection::Notes {
                    state.content["notes"] = after.clone();
                } else {
                    let items = state.content[key]
                        .as_array_mut()
                        .ok_or(Error::Incompatible)?;
                    if *operation == Operation::Add {
                        items.push(after.clone());
                    } else {
                        items[position as usize] = after.clone();
                    }
                }
                if serde_json::to_vec(&state.content)
                    .map_err(|_| Error::Incompatible)?
                    .len()
                    > MAX_STATE_BYTES
                {
                    return Err(Error::Unsupported);
                }
                tx.execute("INSERT INTO aether_access.collaboration_heads VALUES($1,$2,$3) ON CONFLICT(tenant,document_id) DO UPDATE SET revision=excluded.revision",&[&self.tenant(),id,&i64::from(revision)]).await.map_err(db)?;
                tx.execute("INSERT INTO aether_access.collaboration_items VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant,document_id,collection,item_id) DO UPDATE SET value=excluded.value",&[&self.tenant(),id,&key,&item_id,&position,&after]).await.map_err(db)?;
                tx.execute(
                    "INSERT INTO aether_access.collaboration_receipts VALUES($1,$2,$3,$4,$5,$6,$7)",
                    &[
                        &self.tenant(),
                        &actor.id,
                        operation_id,
                        id,
                        &request,
                        &i64::from(revision),
                        &editor_required,
                    ],
                )
                .await
                .map_err(db)?;
                tx.execute("INSERT INTO aether_access.collaboration_events VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",&[&self.tenant(),id,&i64::from(revision),&actor.id,&now,&key,&action,&item_id,&before.unwrap_or(Value::Null),&after,operation_id]).await.map_err(db)?;
                let stored_bytes:i64=tx.query_one("SELECT sum(octet_length(value::text))::bigint FROM aether_access.collaboration_items WHERE tenant=$1 AND document_id=$2", &[&self.tenant(),id]).await.map_err(db)?.get(0);
                if stored_bytes > MAX_STATE_BYTES as i64 {
                    return Err(Error::Unsupported);
                }
                self.audit(&tx, &actor, "collaboration_mutated", id).await?;
                state.revision = revision;
                replay = Some((i64::from(revision), false));
            }
        }
        // Resolve mutable labels for display only. Historical items and receipts stay unchanged.
        for item in state.content["comments"]
            .as_array_mut()
            .ok_or(Error::Incompatible)?
        {
            if let Some(branch_id) = item["branch_id"].as_str() {
                let head = heads
                    .iter()
                    .find(|h| h.id.as_deref() == Some(branch_id))
                    .ok_or(Error::Incompatible)?;
                item["branch"] = json!(head.name);
            } else if item["branch"] != "Main" {
                return Err(Error::Incompatible);
            }
        }
        let mut response = self
            .collaboration_response(&tx, &actor, id, &resource.owner, state, members)
            .await?;
        if let Some((revision, replayed)) = replay {
            response["applied_revision"] = json!(revision);
            response["replayed"] = json!(replayed);
        }
        commit(tx).await?;
        Ok(response)
    }
}
