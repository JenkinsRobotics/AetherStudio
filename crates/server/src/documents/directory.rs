//! Membership-scoped directory; server administration is not document access.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use aether_identity::User;
use aether_protocol_core::directory::*;
use tokio_postgres::{Transaction, error::SqlState};

fn name(value: &str) -> Result<&str> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 80 || value.chars().any(char::is_control) {
        return Err(Error::Invalid);
    }
    Ok(value)
}
fn page(after: Option<&str>, limit: u32) -> Result<i64> {
    if !(1..=100).contains(&limit) || after.is_some_and(|v| !valid_id(v)) {
        return Err(Error::Invalid);
    }
    Ok(i64::from(limit) + 1)
}
fn insert_error(error: tokio_postgres::Error) -> Error {
    if error.code() == Some(&SqlState::UNIQUE_VIOLATION) {
        Error::Conflict
    } else {
        db(error)
    }
}
fn role(value: WorkspaceRole) -> &'static str {
    match value {
        WorkspaceRole::Owner => "owner",
        WorkspaceRole::Editor => "editor",
        WorkspaceRole::Viewer => "viewer",
    }
}
impl Documents {
    pub async fn manage_directory(&self, token: &str, change: &DirectoryChange) -> Result<()> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let actor = self.begin(&tx, token, true).await?;
        self.directory_change_in(&tx, &actor, change).await?;
        commit(tx).await
    }
    /// The caller holds current identity and the exclusive tenant ACL lock.
    pub(super) async fn directory_change_in(
        &self,
        tx: &Transaction<'_>,
        actor: &User,
        change: &DirectoryChange,
    ) -> Result<()> {
        Self::admin(actor)?;
        let (action, target) = match change {
            DirectoryChange::CreateOrganization {
                id,
                name: label,
                default_workspace_id,
            } => {
                if !valid_id(id)
                    || !valid_id(default_workspace_id)
                    || id == "default"
                    || default_workspace_id == "shared"
                {
                    return Err(Error::Invalid);
                }
                let label = name(label)?;
                tx.execute(
                    "INSERT INTO aether_access.organizations(tenant,id,name) VALUES($1,$2,$3)",
                    &[&self.tenant(), id, &label],
                )
                .await
                .map_err(insert_error)?;
                tx.execute(
                    "INSERT INTO aether_access.members VALUES($1,$2,$3,'owner')",
                    &[&self.tenant(), id, &actor.id],
                )
                .await
                .map_err(db)?;
                tx.execute("INSERT INTO aether_access.workspaces(tenant,id,organization,is_default,name) VALUES($1,$2,$3,true,'Shared')",&[&self.tenant(),default_workspace_id,id]).await.map_err(insert_error)?;
                tx.execute(
                    "INSERT INTO aether_access.workspace_members VALUES($1,$2,$3,'owner')",
                    &[&self.tenant(), default_workspace_id, &actor.id],
                )
                .await
                .map_err(db)?;
                ("create_organization", id)
            }
            DirectoryChange::CreateWorkspace {
                id,
                organization,
                name: label,
            } => {
                if !valid_id(id) || !valid_id(organization) || id == "shared" {
                    return Err(Error::Invalid);
                }
                let label = name(label)?;
                if tx
                    .query_opt(
                        "SELECT 1 FROM aether_access.organizations WHERE tenant=$1 AND id=$2",
                        &[&self.tenant(), organization],
                    )
                    .await
                    .map_err(db)?
                    .is_none()
                {
                    return Err(Error::Denied);
                }
                tx.execute("INSERT INTO aether_access.workspaces(tenant,id,organization,is_default,name) VALUES($1,$2,$3,false,$4)",&[&self.tenant(),id,organization,&label]).await.map_err(insert_error)?;
                // Match Studio: assigning the creator a workspace role does not
                // enroll that administrator into a private organization.
                tx.execute(
                    "INSERT INTO aether_access.workspace_members VALUES($1,$2,$3,'owner')",
                    &[&self.tenant(), id, &actor.id],
                )
                .await
                .map_err(db)?;
                ("create_workspace", id)
            }
            DirectoryChange::WorkspaceMember {
                organization,
                workspace,
                user,
                role: assignment,
            } => {
                if !valid_id(organization) || !valid_id(workspace) {
                    return Err(Error::Invalid);
                }
                self.active_user(tx, user).await?;
                self.workspace_member_in(tx, organization, workspace, user, assignment.map(role))
                    .await?;
                // Explicit file shares remain separate permissions; a default
                // workspace still gives organization members viewer access.
                self.audit(tx, actor, "workspace_member_user", user).await?;
                ("workspace_member", workspace)
            }
        };
        self.audit(tx, actor, action, target).await?;
        Ok(())
    }
    /// Shared canonical assignment; caller owns identity, ACL lock and audit.
    pub(super) async fn workspace_member_in(
        &self,
        tx: &Transaction<'_>,
        organization: &str,
        workspace: &str,
        user: &str,
        assignment: Option<&str>,
    ) -> Result<()> {
        if self.member(tx,user,organization).await?.is_none() || tx.query_opt("SELECT 1 FROM aether_access.workspaces WHERE tenant=$1 AND id=$2 AND organization=$3",&[&self.tenant(),&workspace,&organization]).await.map_err(db)?.is_none() { return Err(Error::Denied); }
        let old=tx.query_opt("SELECT role FROM aether_access.workspace_members WHERE tenant=$1 AND workspace=$2 AND user_id=$3",&[&self.tenant(),&workspace,&user]).await.map_err(db)?;
        if old.is_some_and(|r| r.get::<_, &str>(0) == "owner") && assignment != Some("owner") {
            let owners:i64=tx.query_one("SELECT count(*) FROM aether_access.workspace_members WHERE tenant=$1 AND workspace=$2 AND role='owner'",&[&self.tenant(),&workspace]).await.map_err(db)?.get(0);
            if owners <= 1 {
                return Err(Error::Conflict);
            }
        }
        if let Some(assignment) = assignment {
            tx.execute("INSERT INTO aether_access.workspace_members VALUES($1,$2,$3,$4) ON CONFLICT(tenant,workspace,user_id) DO UPDATE SET role=excluded.role",&[&self.tenant(),&workspace,&user,&assignment]).await.map_err(db)?;
        } else {
            tx.execute("DELETE FROM aether_access.workspace_members WHERE tenant=$1 AND workspace=$2 AND user_id=$3",&[&self.tenant(),&workspace,&user]).await.map_err(db)?;
        }
        Ok(())
    }
    pub async fn list_organizations(
        &self,
        token: &str,
        request: &OrganizationListRequest,
    ) -> Result<OrganizationPage> {
        let limit = page(request.after.as_deref(), request.limit)?;
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        let rows=tx.query("SELECT o.id,coalesce(nullif(o.name,''),o.id),m.role FROM aether_access.organizations o JOIN aether_access.members m ON m.tenant=o.tenant AND m.organization=o.id WHERE o.tenant=$1 AND m.user_id=$2 AND ($3::text IS NULL OR o.id COLLATE \"C\">$3 COLLATE \"C\") ORDER BY o.id COLLATE \"C\" LIMIT $4",&[&self.tenant(),&user.id,&request.after,&limit]).await.map_err(db)?;
        let more = rows.len() > request.limit as usize;
        let mut organizations = Vec::new();
        for row in rows.into_iter().take(request.limit as usize) {
            let role = match row.get::<_, &str>(2) {
                "owner" => OrganizationRole::Owner,
                "member" => OrganizationRole::Member,
                _ => return Err(Error::Incompatible),
            };
            organizations.push(OrganizationSummary {
                id: row.get(0),
                name: row.get(1),
                role,
            });
        }
        let next_after = if more {
            organizations.last().map(|v| v.id.clone())
        } else {
            None
        };
        commit(tx).await?;
        Ok(OrganizationPage {
            organizations,
            next_after,
        })
    }
    pub async fn list_workspaces(
        &self,
        token: &str,
        request: &WorkspaceListRequest,
    ) -> Result<WorkspacePage> {
        let limit = page(request.after.as_deref(), request.limit)?;
        if !valid_id(&request.organization) {
            return Err(Error::Invalid);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        let owner = self
            .member(&tx, &user.id, &request.organization)
            .await?
            .ok_or(Error::Denied)?
            == "owner";
        // Filter permission before lookahead/limit; hidden workspace names and
        // identifiers never enter a returned cursor or count.
        let rows=tx.query("SELECT w.id,coalesce(nullif(w.name,''),w.id),w.is_default FROM aether_access.workspaces w WHERE w.tenant=$1 AND w.organization=$2 AND ($3::text IS NULL OR w.id COLLATE \"C\">$3 COLLATE \"C\") AND ($4 OR (w.is_default AND w.id<>'shared') OR EXISTS(SELECT 1 FROM aether_access.workspace_members m WHERE m.tenant=w.tenant AND m.workspace=w.id AND m.user_id=$5)) ORDER BY w.id COLLATE \"C\" LIMIT $6",&[&self.tenant(),&request.organization,&request.after,&owner,&user.id,&limit]).await.map_err(db)?;
        let more = rows.len() > request.limit as usize;
        let mut workspaces = Vec::new();
        for row in rows.into_iter().take(request.limit as usize) {
            let id: String = row.get(0);
            let role = match self
                .workspace_role(&tx, &user.id, &request.organization, &id)
                .await?
                .ok_or(Error::Incompatible)?
            {
                Role::Owner => WorkspaceRole::Owner,
                Role::Editor => WorkspaceRole::Editor,
                Role::Viewer => WorkspaceRole::Viewer,
            };
            workspaces.push(WorkspaceSummary {
                id,
                organization: request.organization.clone(),
                name: row.get(1),
                role,
                is_default: row.get(2),
            });
        }
        let next_after = if more {
            workspaces.last().map(|v| v.id.clone())
        } else {
            None
        };
        commit(tx).await?;
        Ok(WorkspacePage {
            workspaces,
            next_after,
        })
    }
}
