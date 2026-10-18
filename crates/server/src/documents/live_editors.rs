//! An opt-in editor mailbox. Studio owns authority/delivery; products own tools.
//! Dispatch happens at most once. A lost dispatch/reply is outcome_unknown,
//! never an excuse to replay a mutation. No bearer credentials are persisted.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use aether_identity::automation::AgentAccess;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use tokio_postgres::Transaction;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Register {
    pub app: String,
    pub document: String,
    pub context: String,
    pub tools: Vec<Value>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Poll {
    pub editor: String,
    pub secret: String,
    pub running: Option<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Reply {
    pub editor: String,
    pub secret: String,
    pub operation: String,
    pub result: Value,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Target {
    editor: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Invoke {
    operation: String,
    editor: String,
    name: String,
    arguments: Value,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Receipt {
    editor: String,
    operation: String,
}
#[derive(Serialize)]
struct Editor {
    id: String,
    document: String,
    app: String,
    context: String,
    tools: Value,
}
fn parse<T: serde::de::DeserializeOwned>(v: Value) -> Result<T> {
    serde_json::from_value(v).map_err(|_| Error::Invalid)
}
fn hash(secret: &str) -> Vec<u8> {
    Sha256::digest(secret.as_bytes()).to_vec()
}
fn field(s: &str) -> Result<()> {
    if valid_id(s) {
        Ok(())
    } else {
        Err(Error::Invalid)
    }
}

pub(super) fn descriptors() -> Vec<aether_protocol_core::CommandDescriptor> {
    serde_json::from_str(include_str!("live_editor_catalog.json")).expect("live editor contract")
}
impl Documents {
    async fn editor_access(
        &self,
        tx: &Transaction<'_>,
        user: &aether_identity::User,
        document: &str,
        app: &str,
    ) -> Result<()> {
        self.app(tx, user, app).await?;
        let resource = self.require(tx, user, document, Role::Editor).await?;
        if resource.app != app || !matches!(app, "cad" | "map") {
            return Err(Error::Denied);
        }
        Ok(())
    }
    async fn editor(
        &self,
        tx: &Transaction<'_>,
        owner: &str,
        id: &str,
        active: bool,
    ) -> Result<Editor> {
        field(id)?;
        let row=tx.query_opt("SELECT id,document,app,context,tools FROM aether_access.live_editors WHERE tenant=$1 AND owner=$2 AND id=$3 AND (NOT $4 OR (NOT closed AND expires>clock_timestamp())) FOR UPDATE", &[&self.tenant(),&owner,&id,&active]).await.map_err(db)?.ok_or(Error::Denied)?;
        Ok(Editor {
            id: row.get(0),
            document: row.get(1),
            app: row.get(2),
            context: row.get(3),
            tools: row.get(4),
        })
    }
    async fn editor_secret(
        &self,
        tx: &Transaction<'_>,
        owner: &str,
        id: &str,
        secret: &str,
    ) -> Result<Editor> {
        if secret.len() > 128 {
            return Err(Error::Invalid);
        }
        let e = self.editor(tx, owner, id, true).await?;
        if tx.query_opt("SELECT 1 FROM aether_access.live_editors WHERE tenant=$1 AND id=$2 AND secret_hash=$3", &[&self.tenant(),&id,&hash(secret)]).await.map_err(db)?.is_none(){return Err(Error::Denied);}
        Ok(e)
    }
    async fn call_authority(
        &self,
        tx: &Transaction<'_>,
        e: &Editor,
        owner: &str,
        grant: &str,
    ) -> Result<()> {
        let (user, _) = self
            .identity
            .authorize_agent_id_transaction(tx, grant, &e.app)
            .await?;
        if user.id != owner {
            return Err(Error::Denied);
        }
        self.editor_access(tx, &user, &e.document, &e.app).await
    }
    pub async fn live_editor_browser(
        &self,
        session: &str,
        action: &str,
        data: Value,
    ) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, session, false).await?;
        let result = match action {
            "register" => {
                let input: Register = parse(data)?;
                if input.context.is_empty()
                    || input.context.len() > 2048
                    || input.context.chars().any(char::is_control)
                {
                    return Err(Error::Invalid);
                }
                self.editor_access(&tx, &user, &input.document, &input.app)
                    .await?;
                let tools = crate::agents::tools::catalogue(&json!({"tools":input.tools}))
                    .map_err(|_| Error::Invalid)?;
                if tools.is_empty()
                    || tools.iter().any(|t| {
                        !t["name"]
                            .as_str()
                            .unwrap()
                            .starts_with(&format!("aether_{}_", input.app))
                    })
                {
                    return Err(Error::Invalid);
                }
                tx.execute(
                    "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062626))",
                    &[&format!("{}:{}", self.tenant(), user.id)],
                )
                .await
                .map_err(db)?;
                let counts=tx.query_one("SELECT count(*),count(*) FILTER(WHERE NOT closed AND expires>clock_timestamp()) FROM aether_access.live_editors WHERE tenant=$1 AND owner=$2", &[&self.tenant(),&user.id]).await.map_err(db)?;
                if counts.get::<_, i64>(0) >= 4096 || counts.get::<_, i64>(1) >= 16 {
                    return Err(Error::Conflict);
                }
                let id = super::automation::random_id()?;
                let secret = super::automation::random_id()?;
                tx.execute("INSERT INTO aether_access.live_editors(tenant,id,owner,document,app,context,secret_hash,tools,expires) VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()+interval '15 seconds')", &[&self.tenant(),&id,&user.id,&input.document,&input.app,&input.context,&hash(&secret),&json!(tools)]).await.map_err(db)?;
                json!({"editor":id,"secret":secret})
            }
            "poll" | "close" => {
                let input: Poll = parse(data)?;
                let e = self
                    .editor_secret(&tx, &user.id, &input.editor, &input.secret)
                    .await?;
                self.editor_access(&tx, &user, &e.document, &e.app).await?;
                if action == "close" {
                    tx.execute("UPDATE aether_access.live_editors SET closed=true WHERE tenant=$1 AND id=$2", &[&self.tenant(),&e.id]).await.map_err(db)?;
                    tx.execute("UPDATE aether_access.live_editor_calls SET state='cancelled' WHERE tenant=$1 AND editor=$2 AND state='queued'", &[&self.tenant(),&e.id]).await.map_err(db)?;
                    json!({"closed":true})
                } else {
                    tx.execute("UPDATE aether_access.live_editors SET expires=clock_timestamp()+interval '15 seconds' WHERE tenant=$1 AND id=$2", &[&self.tenant(),&e.id]).await.map_err(db)?;
                    if let Some(operation) = input.running {
                        field(&operation)?;
                        let row=tx.query_opt("SELECT grant_id FROM aether_access.live_editor_calls WHERE tenant=$1 AND editor=$2 AND operation=$3 AND state IN ('running','completed') AND expires>clock_timestamp()", &[&self.tenant(),&e.id,&operation]).await.map_err(db)?.ok_or(Error::Conflict)?;
                        self.call_authority(&tx, &e, &user.id, row.get(0)).await?;
                        json!({"authorized":true})
                    } else {
                        // Never redeliver a running command, even after a process restart.
                        let running:bool=tx.query_one("SELECT EXISTS(SELECT 1 FROM aether_access.live_editor_calls WHERE tenant=$1 AND editor=$2 AND state='running' AND expires>clock_timestamp())", &[&self.tenant(),&e.id]).await.map_err(db)?.get(0);
                        if running {
                            json!({"call":null})
                        } else {
                            let row=tx.query_opt("SELECT operation,grant_id,name,arguments FROM aether_access.live_editor_calls WHERE tenant=$1 AND editor=$2 AND state='queued' AND expires>clock_timestamp() ORDER BY created LIMIT 1 FOR UPDATE", &[&self.tenant(),&e.id]).await.map_err(db)?;
                            if let Some(row) = row {
                                let operation: String = row.get(0);
                                if self
                                    .call_authority(&tx, &e, &user.id, row.get(1))
                                    .await
                                    .is_err()
                                {
                                    tx.execute("UPDATE aether_access.live_editor_calls SET state='cancelled' WHERE tenant=$1 AND editor=$2 AND operation=$3", &[&self.tenant(),&e.id,&operation]).await.map_err(db)?;
                                    json!({"call":null})
                                } else {
                                    tx.execute("UPDATE aether_access.live_editor_calls SET state='running' WHERE tenant=$1 AND editor=$2 AND operation=$3", &[&self.tenant(),&e.id,&operation]).await.map_err(db)?;
                                    json!({"call":{"id":operation,"name":row.get::<_,String>(2),"arguments":row.get::<_,Value>(3)}})
                                }
                            } else {
                                json!({"call":null})
                            }
                        }
                    }
                }
            }
            "reply" => {
                let input: Reply = parse(data)?;
                field(&input.operation)?;
                let e = self
                    .editor_secret(&tx, &user.id, &input.editor, &input.secret)
                    .await?;
                self.editor_access(&tx, &user, &e.document, &e.app).await?;
                let result = crate::agents::tools::result(&json!({"result":input.result}))
                    .map_err(|_| Error::Invalid)?;
                let row=tx.query_opt("SELECT grant_id,state,reply,expires>clock_timestamp() FROM aether_access.live_editor_calls WHERE tenant=$1 AND editor=$2 AND operation=$3 FOR UPDATE", &[&self.tenant(),&e.id,&input.operation]).await.map_err(db)?.ok_or(Error::Denied)?;
                self.call_authority(&tx, &e, &user.id, row.get(0)).await?;
                let state: &str = row.get(1);
                if state == "completed" {
                    if row.get::<_, Option<Value>>(2).as_ref() != Some(&result) {
                        return Err(Error::Conflict);
                    }
                } else {
                    if state != "running" || !row.get::<_, bool>(3) {
                        return Err(Error::Conflict);
                    }
                    tx.execute("UPDATE aether_access.live_editor_calls SET state='completed',reply=$4 WHERE tenant=$1 AND editor=$2 AND operation=$3", &[&self.tenant(),&e.id,&input.operation,&result]).await.map_err(db)?;
                }
                json!({"received":true})
            }
            _ => return Err(Error::Invalid),
        };
        commit(tx).await?;
        Ok(result)
    }
    pub(super) async fn live_editor_command(
        &self,
        token: &str,
        input: super::automation::Run,
    ) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let (user, grant) = self
            .identity
            .authorize_agent_transaction(&tx, token, None, AgentAccess::Edit)
            .await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        if input.id != "editor.invoke" && input.operation_id.is_some() {
            return Err(Error::Invalid);
        }
        let result = match input.id.as_str() {
            "editor.list" => {
                if input.arguments != json!({}) || input.operation_id.is_some() {
                    return Err(Error::Invalid);
                }
                let rows=tx.query("SELECT id,document,app,context FROM aether_access.live_editors WHERE tenant=$1 AND owner=$2 AND NOT closed AND expires>clock_timestamp() ORDER BY id LIMIT 16", &[&self.tenant(),&user.id]).await.map_err(db)?;
                let mut items = vec![];
                for r in rows {
                    let app: String = r.get(2);
                    let doc: String = r.get(1);
                    if grant.apps.contains(&app)
                        && self.editor_access(&tx, &user, &doc, &app).await.is_ok()
                    {
                        items.push(json!({"editor":r.get::<_,String>(0),"document":doc,"app":app,"context":r.get::<_,String>(3)}));
                    }
                }
                json!({"editors":items})
            }
            "editor.inspect" | "editor.result" | "editor.invoke" => {
                let (id, invoke, receipt) = match input.id.as_str() {
                    "editor.inspect" => {
                        let a: Target = parse(input.arguments)?;
                        (a.editor, None, None)
                    }
                    "editor.result" => {
                        let a: Receipt = parse(input.arguments)?;
                        (a.editor.clone(), None, Some(a))
                    }
                    _ => {
                        let a: Invoke = parse(input.arguments)?;
                        (a.editor.clone(), Some(a), None)
                    }
                };
                let e = self.editor(&tx, &user.id, &id, receipt.is_none()).await?;
                if !grant.apps.contains(&e.app) {
                    return Err(Error::Denied);
                }
                self.editor_access(&tx, &user, &e.document, &e.app).await?;
                if let Some(a) = invoke {
                    let operation = a.operation;
                    if input
                        .operation_id
                        .as_ref()
                        .is_some_and(|id| id != &operation)
                    {
                        return Err(Error::Invalid);
                    }
                    field(&operation)?;
                    if !a.arguments.is_object()
                        || a.arguments.to_string().len() > 32768
                        || !e
                            .tools
                            .as_array()
                            .unwrap()
                            .iter()
                            .any(|t| t["name"] == a.name)
                    {
                        return Err(Error::Invalid);
                    }
                    let existing=tx.query_opt("SELECT grant_id,name,arguments FROM aether_access.live_editor_calls WHERE tenant=$1 AND editor=$2 AND operation=$3", &[&self.tenant(),&id,&operation]).await.map_err(db)?;
                    if let Some(row) = existing {
                        if row.get::<_, String>(0) != grant.id
                            || row.get::<_, String>(1) != a.name
                            || row.get::<_, Value>(2) != a.arguments
                        {
                            return Err(Error::Conflict);
                        }
                    } else {
                        let count:i64=tx.query_one("SELECT count(*) FROM aether_access.live_editor_calls WHERE tenant=$1 AND editor=$2", &[&self.tenant(),&id]).await.map_err(db)?.get(0);
                        if count >= 1000 {
                            return Err(Error::Conflict);
                        }
                        let pending:bool=tx.query_one("SELECT EXISTS(SELECT 1 FROM aether_access.live_editor_calls WHERE tenant=$1 AND editor=$2 AND state IN ('queued','running') AND expires>clock_timestamp())", &[&self.tenant(),&id]).await.map_err(db)?.get(0);
                        if pending {
                            return Err(Error::Conflict);
                        }
                        tx.execute("INSERT INTO aether_access.live_editor_calls(tenant,editor,operation,grant_id,name,arguments,state) VALUES($1,$2,$3,$4,$5,$6,'queued')", &[&self.tenant(),&id,&operation,&grant.id,&a.name,&a.arguments]).await.map_err(db)?;
                        self.identity
                            .audit_agent_command_in(&tx, &user, &grant, "editor.invoke")
                            .await?;
                    }
                    json!({"editor":id,"operation":operation,"accepted":true,"next":"editor.result"})
                } else if let Some(a) = receipt {
                    field(&a.operation)?;
                    let row=tx.query_opt("SELECT state,reply,expires>clock_timestamp() FROM aether_access.live_editor_calls WHERE tenant=$1 AND editor=$2 AND operation=$3 AND grant_id=$4", &[&self.tenant(),&id,&a.operation,&grant.id]).await.map_err(db)?.ok_or(Error::Denied)?;
                    let state: &str = row.get(0);
                    let online:bool=tx.query_one("SELECT NOT closed AND expires>clock_timestamp() FROM aether_access.live_editors WHERE tenant=$1 AND id=$2", &[&self.tenant(),&id]).await.map_err(db)?.get(0);
                    let state = if matches!(state, "queued" | "running")
                        && (!row.get::<_, bool>(2) || !online)
                    {
                        if state == "running" {
                            "outcome_unknown"
                        } else {
                            "expired"
                        }
                    } else {
                        state
                    };
                    json!({"live_editor":{"editor":id,"operation":a.operation,"state":state,"reply":row.get::<_,Option<Value>>(1)}})
                } else {
                    if input.operation_id.is_some() {
                        return Err(Error::Invalid);
                    }
                    json!({"editor":e,"requires":"content-edit grant and explicitly shared editor","delivery":"at-most-once; inspect after outcome_unknown"})
                }
            }
            _ => return Err(Error::Unsupported),
        };
        commit(tx).await?;
        Ok(result)
    }
}
