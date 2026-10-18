//! Legacy editor home projection. This endpoint has no pagination contract, so
//! exceeding its bounded scan fails explicitly instead of returning a partial home.
use super::*;
use std::time::Duration;

const MAX_CANDIDATES: i64 = 2048;

impl Documents {
    pub(super) async fn library_list(
        &self,
        token: &str,
        app: &str,
        view: Option<&str>,
        parent: Option<&str>,
        query: Option<&str>,
    ) -> Result<Value> {
        let view = view.unwrap_or("personal");
        let parent = parent.filter(|p| !p.is_empty());
        let query = query.unwrap_or("");
        if !valid_id(app)
            || !matches!(view, "personal" | "workspace" | "recent")
            || parent.is_some_and(|p| !valid_id(p))
            || query.len() > 1024
            || query.chars().any(char::is_control)
        {
            return Err(Error::Invalid);
        }
        // Existing editor searches are literal, case-insensitive, across folders.
        let query: String = query.trim().to_lowercase().chars().take(200).collect();
        tokio::time::timeout(
            Duration::from_secs(10),
            self.library_list_inner(token, app, view, parent, &query),
        )
        .await
        .map_err(|_| Error::Unavailable)?
    }

    async fn library_list_inner(
        &self,
        token: &str,
        app: &str,
        view: &str,
        parent: Option<&str>,
        query: &str,
    ) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        self.app(&tx, &user, app).await?;
        if let Some(parent) = parent {
            let folder = self.require(&tx, &user, parent, Role::Viewer).await?;
            self.app(&tx, &user, &folder.app).await?;
            if folder.kind != "folder" {
                return Err(Error::Invalid);
            }
        }
        // Scope filtering is not authorization. Every returned item is checked
        // under the same identity/ACL transaction, including trashed ancestors.
        let rows = tx
            .query(
                "SELECT r.id,r.kind,EXTRACT(EPOCH FROM recent.opened)::double precision,r.app
             FROM aether_access.resources r
             LEFT JOIN aether_access.library_recents recent
               ON recent.tenant=r.tenant AND recent.resource=r.id AND recent.user_id=$2
             WHERE r.tenant=$1 AND NOT r.trashed AND (r.app=$3 OR r.kind='folder')
               AND (($4='personal' AND r.workspace IS NULL AND r.owner=$2)
                 OR ($4='workspace' AND r.workspace IS NOT NULL)
                 OR ($4='recent' AND recent.resource IS NOT NULL AND r.kind='document'))
               AND ($5 OR $4='recent' OR r.parent IS NOT DISTINCT FROM $6)
             ORDER BY r.id COLLATE \"C\" LIMIT $7",
                &[
                    &self.tenant(),
                    &user.id,
                    &app,
                    &view,
                    &!query.is_empty(),
                    &parent,
                    &(MAX_CANDIDATES + 1),
                ],
            )
            .await
            .map_err(db)?;
        if rows.len() > MAX_CANDIDATES as usize {
            return Err(Error::Unavailable);
        }
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        let mut files = Vec::new();
        for row in rows {
            let id: String = row.get(0);
            let kind: &str = row.get(1);
            if kind == "folder" {
                let folder_app: &str = row.get(3);
                match self.app(&tx, &user, folder_app).await {
                    Ok(()) => (),
                    Err(Error::Denied) => continue,
                    Err(error) => return Err(error),
                }
            }
            match self.require(&tx, &user, &id, Role::Viewer).await {
                Ok(_) => (),
                Err(Error::Denied) => continue,
                Err(error) => return Err(error),
            }
            let entry = if kind == "document" {
                let doc = self.store.metadata_in(&tx, &scope, &id).await?;
                if doc.app != app {
                    return Err(Error::Incompatible);
                }
                if !doc.name.to_lowercase().contains(query) {
                    continue;
                }
                self.library_metadata(&tx, &user, &doc).await?
            } else if kind == "folder" {
                let entry = self.library_folder_metadata(&tx, &user, &id).await?;
                if !entry["name"]
                    .as_str()
                    .ok_or(Error::Incompatible)?
                    .to_lowercase()
                    .contains(query)
                {
                    continue;
                }
                entry
            } else {
                return Err(Error::Incompatible);
            };
            let opened: Option<f64> = row.get(2);
            files.push((entry, opened));
        }
        let ids: Vec<String> = files
            .iter()
            .filter(|(v, _)| v["kind"] != "folder")
            .filter_map(|(v, _)| v["id"].as_str().map(str::to_owned))
            .collect();
        let summaries: std::collections::BTreeMap<String,(i64,String)> = tx.query(
            "SELECT document_id,count(*),(array_agg(name ORDER BY created DESC,name COLLATE \"C\"))[1] FROM aether_access.named_versions WHERE tenant=$1 AND document_id=ANY($2) GROUP BY document_id",
            &[&self.tenant(),&ids]).await.map_err(db)?.into_iter().map(|r|(r.get(0),(r.get(1),r.get(2)))).collect();
        for (entry, _) in &mut files {
            let summary = entry["id"].as_str().and_then(|id| summaries.get(id));
            entry["versions"] = json!(summary.map_or(0, |(count, _)| *count));
            entry["latest_version"] = json!(summary.map(|(_, name)| name));
        }
        files.sort_by(|(a, opened_a), (b, opened_b)| {
            let order = if view == "recent" {
                opened_b.unwrap_or(0.0).total_cmp(&opened_a.unwrap_or(0.0))
            } else {
                (b["kind"] == "folder")
                    .cmp(&(a["kind"] == "folder"))
                    .then_with(|| {
                        b["modified"]
                            .as_f64()
                            .unwrap_or(0.0)
                            .total_cmp(&a["modified"].as_f64().unwrap_or(0.0))
                    })
            };
            order.then_with(|| a["id"].as_str().cmp(&b["id"].as_str()))
        });
        commit(tx).await?;
        Ok(
            json!({"files":files.into_iter().map(|(entry,_)| entry).collect::<Vec<_>>(),
            "capabilities":{"named_versions":true,"version_lifecycle":true,"branches":false}}),
        )
    }

    pub(in crate::documents) async fn library_folder_metadata(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
    ) -> Result<Value> {
        self.library_folder_metadata_visibility(tx, user, id, false)
            .await
    }
    pub(in crate::documents) async fn library_folder_metadata_visibility(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
        include_trash: bool,
    ) -> Result<Value> {
        let state = self
            .visible_resource_state(tx, user, self.resource_snapshot(tx, user, id).await?)
            .await?;
        let writable = match self
            .require_resource(tx, user, id, Role::Editor, include_trash)
            .await
        {
            Ok(_) => true,
            Err(Error::Denied) => false,
            Err(error) => return Err(error),
        };
        let owner: String = tx.query_one("SELECT coalesce(nullif(full_name,''),username) FROM aether_identity.users WHERE tenant=$1 AND id=$2", &[&self.tenant(), &state.owner]).await.map_err(db)?.get(0);
        // The canonical creation audit and structural events already own these
        // timestamps. No additional mutable metadata store or schema is needed.
        let times = tx.query_one(
            "SELECT EXTRACT(EPOCH FROM min(happened_at))::double precision,
               EXTRACT(EPOCH FROM greatest(min(happened_at),
                 (SELECT max(happened_at) FROM aether_access.resource_events WHERE tenant=$1 AND resource=$2)))::double precision
             FROM aether_access.audit WHERE tenant=$1 AND target=$2 AND action='create_folder'",
            &[&self.tenant(), &id],
        ).await.map_err(db)?;
        let created: f64 = times.get::<_, Option<f64>>(0).ok_or(Error::Incompatible)?;
        let modified: f64 = times.get::<_, Option<f64>>(1).ok_or(Error::Incompatible)?;
        Ok(
            json!({"id":id,"app":state.app,"name":state.name,"kind":"folder",
            "scope":if state.location.workspace.is_some(){"workspace"}else{"personal"},
            "organization":state.location.organization,"workspace":state.location.workspace,
            "parent":state.location.parent,"parent_hidden":state.parent_hidden,
            "owner":owner,"writable":writable,"size":0,"revision":state.structure_revision,
            "structure_revision":state.structure_revision,"created":created,"modified":modified}),
        )
    }
}
