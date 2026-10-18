//! Studio Admin Center compatibility. Administrative directory visibility never
//! creates organization membership or authorizes private document content.
use super::{Documents, Error, Result, commit, db, valid_id};
use aether_protocol_core::directory::DirectoryChange;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

#[derive(Deserialize, Serialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    OrganizationCreate {
        operation_id: String,
        name: String,
        organization: Option<String>,
    },
    WorkspaceCreate {
        operation_id: String,
        name: String,
        organization: String,
    },
}

impl Documents {
    pub async fn drive_administration(&self, token: &str) -> Result<Value> {
        tokio::time::timeout(
            std::time::Duration::from_secs(10),
            self.administration_inner(token),
        )
        .await
        .map_err(|_| Error::Unavailable)?
    }
    async fn administration_inner(&self, token: &str) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.identity.authorize_transaction(&tx, token).await?;
        Self::admin(&user)?;
        tx.execute(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        let orgs=tx.query("SELECT id,name FROM aether_access.organizations WHERE tenant=$1 ORDER BY name COLLATE \"C\",id COLLATE \"C\" LIMIT 1001",&[&self.tenant()]).await.map_err(db)?;
        let spaces=tx.query("SELECT id,organization,name,is_default FROM aether_access.workspaces WHERE tenant=$1 ORDER BY name COLLATE \"C\",id COLLATE \"C\" LIMIT 1001",&[&self.tenant()]).await.map_err(db)?;
        if orgs.len() > 1000 || spaces.len() > 1000 {
            return Err(Error::Unsupported);
        }
        // Legacy 'role' describes management controls in this admin projection,
        // not a persisted or effective content-access membership.
        let orgs: Vec<_> = orgs
            .into_iter()
            .map(|r| json!({"id":r.get::<_,String>(0),"name":r.get::<_,String>(1),"role":"owner"}))
            .collect();
        let spaces:Vec<_>=spaces.into_iter().map(|r|json!({"id":r.get::<_,String>(0),"organization":r.get::<_,String>(1),"name":r.get::<_,String>(2),"is_default":r.get::<_,bool>(3),"role":"owner"})).collect();
        let result = json!({"organizations":orgs,"workspaces":spaces,"apps":[],"user":{"id":user.id,"username":user.username,"name":if user.full_name.is_empty() {&user.username} else {&user.full_name},"admin":true}});
        commit(tx).await?;
        Ok(result)
    }
    pub async fn drive_provision(&self, token: &str, input: &Request) -> Result<Value> {
        tokio::time::timeout(
            std::time::Duration::from_secs(20),
            self.provision_inner(token, input),
        )
        .await
        .map_err(|_| Error::OutcomeUnknown)?
    }
    async fn provision_inner(&self, token: &str, input: &Request) -> Result<Value> {
        let (op, title, org) = match input {
            Request::OrganizationCreate {
                operation_id, name, ..
            } => (operation_id, name, None),
            Request::WorkspaceCreate {
                operation_id,
                name,
                organization,
            } => (operation_id, name, Some(organization)),
        };
        if !valid_id(op)
            || title.trim().is_empty()
            || title.trim().chars().count() > 80
            || title.chars().any(char::is_control)
            || org.is_some_and(|s| !valid_id(s))
        {
            return Err(Error::Invalid);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let actor = self.identity.authorize_transaction(&tx, token).await?;
        Self::admin(&actor)?;
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        if let Some(org) = org
            && tx
                .query_opt(
                    "SELECT 1 FROM aether_access.organizations WHERE tenant=$1 AND id=$2",
                    &[&self.tenant(), org],
                )
                .await
                .map_err(db)?
                .is_none()
        {
            return Err(Error::Denied);
        }
        let request = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
        let hash = format!(
            "{:x}",
            Sha256::digest(
                serde_json::to_vec(&(self.tenant(), &actor.id, op)).map_err(|_| Error::Invalid)?
            )
        );
        let id = format!(
            "{}-{hash}",
            if org.is_some() {
                "workspace"
            } else {
                "organization"
            }
        );
        if let Some(old)=tx.query_opt("SELECT request,receipt FROM aether_access.resource_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3",&[&self.tenant(),&actor.id,op]).await.map_err(db)? {
            if old.get::<_,Value>(0)!=request {return Err(Error::Conflict);}
            let mut receipt:Value=old.get(1);
            if receipt["id"]!=id || receipt["operation_id"]!=*op {return Err(Error::Incompatible);}
            let exists=if org.is_some() {
                tx.query_opt("SELECT 1 FROM aether_access.workspaces WHERE tenant=$1 AND id=$2 AND organization=$3",&[&self.tenant(),&id,&org]).await.map_err(db)?.is_some()
            }else{tx.query_opt("SELECT 1 FROM aether_access.organizations WHERE tenant=$1 AND id=$2",&[&self.tenant(),&id]).await.map_err(db)?.is_some()};
            if !exists{return Err(Error::Denied);}
            receipt["replayed"]=json!(true);
            commit(tx).await?;return Ok(receipt);
        }
        let change = if let Some(org) = org {
            DirectoryChange::CreateWorkspace {
                id: id.clone(),
                organization: org.clone(),
                name: title.trim().to_owned(),
            }
        } else {
            DirectoryChange::CreateOrganization {
                id: id.clone(),
                name: title.trim().to_owned(),
                default_workspace_id: format!("default-{hash}"),
            }
        };
        self.directory_change_in(&tx, &actor, &change).await?;
        let result = json!({"id":id,"operation_id":op,"replayed":false});
        tx.execute("INSERT INTO aether_access.resource_receipts(tenant,actor,operation_id,request,receipt) VALUES($1,$2,$3,$4,$5)",&[&self.tenant(),&actor.id,op,&request,&result]).await.map_err(db)?;
        commit(tx).await?;
        Ok(result)
    }
}
