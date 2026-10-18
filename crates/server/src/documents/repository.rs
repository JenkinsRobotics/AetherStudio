use super::policy::Node;
use super::{Documents, Error, Location, Result, Role, db, valid_id};
use aether_identity::User;
use std::collections::HashSet;
use tokio_postgres::Transaction;

pub(super) struct Resource {
    pub owner: String,
    pub kind: String,
    pub app: String,
    pub location: Location,
    pub trashed: bool,
}
impl Documents {
    pub(super) async fn resource(
        &self,
        tx: &Transaction<'_>,
        id: &str,
    ) -> Result<Option<Resource>> {
        if !valid_id(id) {
            return Err(Error::Invalid);
        }
        Ok(tx.query_opt("SELECT owner,kind,app,organization,workspace,parent,trashed FROM aether_access.resources WHERE tenant=$1 AND id=$2",&[&self.tenant(),&id]).await.map_err(db)?.map(|r|Resource{owner:r.get(0),kind:r.get(1),app:r.get(2),location:Location{organization:r.get(3),workspace:r.get(4),parent:r.get(5)},trashed:r.get(6)}))
    }
    pub(super) async fn member(
        &self,
        tx: &Transaction<'_>,
        user: &str,
        org: &str,
    ) -> Result<Option<String>> {
        Ok(tx.query_opt("SELECT role FROM aether_access.members WHERE tenant=$1 AND organization=$2 AND user_id=$3",&[&self.tenant(),&org,&user]).await.map_err(db)?.map(|r|r.get(0)))
    }
    pub(super) async fn workspace_role(
        &self,
        tx: &Transaction<'_>,
        user: &str,
        org: &str,
        workspace: &str,
    ) -> Result<Option<Role>> {
        let Some(member) = self.member(tx, user, org).await? else {
            return Ok(None);
        };
        let Some(row)=tx.query_opt("SELECT is_default FROM aether_access.workspaces WHERE tenant=$1 AND id=$2 AND organization=$3",&[&self.tenant(),&workspace,&org]).await.map_err(db)? else{return Err(Error::Denied);};
        if member == "owner" {
            return Ok(Some(Role::Owner));
        }
        if let Some(row)=tx.query_opt("SELECT role FROM aether_access.workspace_members WHERE tenant=$1 AND workspace=$2 AND user_id=$3",&[&self.tenant(),&workspace,&user]).await.map_err(db)? {return Role::parse(row.get(0)).map(Some).ok_or(Error::Incompatible);}
        Ok(if row.get::<_, bool>(0) && workspace != "shared" {
            Some(Role::Viewer)
        } else {
            None
        })
    }
    pub(super) async fn app(&self, tx: &Transaction<'_>, user: &User, app: &str) -> Result<()> {
        if self.delegation.as_ref().is_some_and(|d| d.app != app) {
            return Err(Error::Denied);
        }
        if self.allowed_apps(tx, user, &[app]).await?.is_empty() {
            Err(Error::Denied)
        } else {
            Ok(())
        }
    }
    pub(super) async fn allowed_apps(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        candidates: &[&str],
    ) -> Result<Vec<String>> {
        // Shared by individual authorization and catalog projection, so the
        // batch optimization cannot acquire a separate application policy.
        let rows = tx.query(
            "SELECT a.id FROM aether_access.applications a WHERE a.tenant=$1 AND a.id=ANY($2) AND a.enabled AND (NOT a.restricted OR $3 OR EXISTS(SELECT 1 FROM aether_access.team_members m JOIN aether_access.team_apps t USING(tenant,team) WHERE m.tenant=a.tenant AND m.user_id=$4 AND t.app=a.id))",
            &[&self.tenant(), &candidates, &(user.role == aether_identity::Role::Admin), &user.id],
        ).await.map_err(db)?;
        Ok(rows.into_iter().map(|row| row.get(0)).collect())
    }
    pub(super) async fn require(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
        minimum: Role,
    ) -> Result<Resource> {
        self.require_resource(tx, user, id, minimum, false).await
    }
    /// Recycle management still validates the full chain and current roles.
    /// Normal document operations always use `require` above.
    pub(super) async fn require_resource(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
        minimum: Role,
        include_trash: bool,
    ) -> Result<Resource> {
        let (resource, role) = self.resource_role(tx, user, id, include_trash).await?;
        if role >= minimum {
            Ok(resource)
        } else {
            Err(Error::Denied)
        }
    }
    /// Return the evaluated current role with the resource so one projection
    /// need not repeat the full ancestry/ACL traversal for viewer/editor flags.
    /// This is transaction-local, never a permission cache across requests.
    pub(super) async fn resource_role(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
        include_trash: bool,
    ) -> Result<(Resource, Role)> {
        let target = self.resource(tx, id).await?.ok_or(Error::Denied)?;
        let member = self
            .member(tx, &user.id, &target.location.organization)
            .await?
            .is_some();
        if !member {
            return Err(Error::Denied);
        }
        let wr = match &target.location.workspace {
            Some(ws) => {
                self.workspace_role(tx, &user.id, &target.location.organization, ws)
                    .await?
            }
            None => None,
        };
        let mut chain = Vec::new();
        let mut seen = HashSet::new();
        let mut next = Some(id.to_owned());
        while let Some(current) = next {
            if chain.len() >= 128 || !seen.insert(current.clone()) {
                return Err(Error::Denied);
            }
            let resource = self.resource(tx, &current).await?.ok_or(Error::Denied)?;
            if resource.location.organization != target.location.organization
                || resource.location.workspace != target.location.workspace
                || (!chain.is_empty() && resource.kind != "folder")
            {
                return Err(Error::Denied);
            }
            let grant=tx.query_opt("SELECT role FROM aether_access.grants WHERE tenant=$1 AND resource=$2 AND user_id=$3",&[&self.tenant(),&current,&user.id]).await.map_err(db)?.map(|r|Role::parse(r.get(0)).ok_or(Error::Incompatible)).transpose()?;
            let link=tx.query_opt("SELECT l.role FROM aether_access.links l JOIN aether_access.link_visits v ON l.tenant=v.tenant AND l.id=v.link WHERE l.tenant=$1 AND l.resource=$2 AND v.user_id=$3 AND NOT l.revoked AND l.expires>clock_timestamp() ORDER BY CASE l.role WHEN 'editor' THEN 2 ELSE 1 END DESC LIMIT 1",&[&self.tenant(),&current,&user.id]).await.map_err(db)?.map(|row|Role::parse(row.get(0)).ok_or(Error::Incompatible)).transpose()?;
            chain.push(Node {
                owner: resource.owner,
                trashed: resource.trashed && !include_trash,
                grant,
                link,
            });
            next = resource.location.parent;
        }
        let role = super::policy::document_role(
            &user.id,
            member,
            target.location.workspace.as_deref(),
            wr,
            &chain,
        )
        .ok_or(Error::Denied)?;
        Ok((target, role))
    }
    pub(super) async fn destination(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        location: &Location,
    ) -> Result<()> {
        if !valid_id(&location.organization)
            || location.workspace.as_ref().is_some_and(|s| !valid_id(s))
            || location.parent.as_ref().is_some_and(|s| !valid_id(s))
        {
            return Err(Error::Invalid);
        }
        if self
            .member(tx, &user.id, &location.organization)
            .await?
            .is_none()
        {
            return Err(Error::Denied);
        }
        if let Some(parent) = &location.parent {
            let resource = self.require(tx, user, parent, Role::Editor).await?;
            if resource.kind != "folder"
                || resource.location.organization != location.organization
                || resource.location.workspace != location.workspace
            {
                return Err(Error::Denied);
            }
        } else if let Some(ws) = &location.workspace {
            let role = self
                .workspace_role(tx, &user.id, &location.organization, ws)
                .await?;
            if !(ws == "shared" && location.organization == "default")
                && !role.is_some_and(|r| r >= Role::Editor)
            {
                return Err(Error::Denied);
            }
        }
        Ok(())
    }
    pub(super) async fn insert_resource(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
        app: &str,
        location: &Location,
        kind: &str,
    ) -> Result<()> {
        if !valid_id(id) || !valid_id(app) {
            return Err(Error::Invalid);
        }
        tx.execute("INSERT INTO aether_access.resources(tenant,id,organization,workspace,parent,owner,kind,app) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",&[&self.tenant(),&id,&location.organization,&location.workspace,&location.parent,&user.id,&kind,&app]).await.map_err(|e|if e.code()==Some(&tokio_postgres::error::SqlState::UNIQUE_VIOLATION){Error::Conflict}else{db(e)})?;
        Ok(())
    }
    pub(super) async fn audit(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        action: &str,
        target: &str,
    ) -> Result<()> {
        tx.execute(
            "INSERT INTO aether_access.audit(tenant,actor,action,target) VALUES($1,$2,$3,$4)",
            &[&self.tenant(), &user.id, &action, &target],
        )
        .await
        .map_err(db)?;
        Ok(())
    }
}
