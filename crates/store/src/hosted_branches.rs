//! Durable branch identity and revision graph. This trusted adapter does not
//! authenticate users: the caller must hold current document permission locks.
use super::*;
use aether_protocol_core::branches::*;
use std::collections::{BTreeMap, BTreeSet};

const MAX_BRANCHES: i64 = 4096;
const MAX_GRAPH_REVISIONS: i64 = 100_000;
const FIELDS: &str = "id,name,head_revision,created_from,actor,created_unix_ms,message,deleted";

pub(super) fn validate_name(name: &str, allow_main: bool) -> Result<()> {
    if name.is_empty()
        || name.trim() != name
        || name.chars().count() > 80
        || name.chars().any(char::is_control)
        || (!allow_main && name == "Main")
    {
        return Err(StoreError::new(
            StoreErrorCode::InvalidRequest,
            "Use a trimmed branch name of 1–80 characters; Main is reserved.",
        ));
    }
    Ok(())
}
pub(super) fn operation_conflict() -> StoreError {
    StoreError::new(
        StoreErrorCode::OperationConflict,
        "Operation ID already used with different arguments.",
    )
}
fn conflict(message: &str) -> StoreError {
    StoreError::new(StoreErrorCode::RevisionConflict, message)
}
fn guard(actual: u32, expected: u32) -> Result<()> {
    if expected == 0 {
        return Err(StoreError::new(
            StoreErrorCode::InvalidRequest,
            "Revision must be positive.",
        ));
    }
    if actual != expected {
        return Err(conflict("Branch head changed; refresh before editing."));
    }
    Ok(())
}
fn from_row(row: &tokio_postgres::Row) -> Result<BranchHead> {
    let number = |index| -> Result<u32> {
        u32::try_from(row.get::<_, i64>(index))
            .ok()
            .filter(|n| *n > 0)
            .ok_or_else(|| corrupt("Invalid branch revision."))
    };
    Ok(BranchHead {
        id: Some(row.get(0)),
        name: row.get(1),
        head_revision: number(2)?,
        created_from: Some(number(3)?),
        author: Some(row.get(4)),
        created_unix_ms: Some(row.get(5)),
        message: row.get(6),
        deleted: row.get(7),
    })
}
pub(super) async fn head(
    client: &impl GenericClient,
    scope: &AuthorizedScope,
    id: &str,
    name: &str,
) -> Result<BranchHead> {
    validate_name(name, true)?;
    if name == "Main" {
        let d = revision(client, &scope.tenant, id, None)
            .await?
            .ok_or_else(not_found)?;
        return Ok(BranchHead {
            id: None,
            name: "Main".into(),
            head_revision: d.revision,
            created_from: None,
            author: None,
            created_unix_ms: None,
            message: String::new(),
            deleted: false,
        });
    }
    client.query_opt(&format!("SELECT {FIELDS} FROM aether_store.branches WHERE tenant=$1 AND document_id=$2 AND name=$3 AND NOT deleted"), &[&scope.tenant, &id, &name]).await.map_err(pg_error)?.as_ref().map(from_row).transpose()?.ok_or_else(not_found)
}

pub(super) async fn target_head(
    client: &impl GenericClient,
    scope: &AuthorizedScope,
    id: &str,
    target: &str,
) -> Result<BranchHead> {
    validate_id(target)?;
    if target == "Main" {
        return head(client, scope, id, "Main").await;
    }
    client.query_opt(&format!("SELECT {FIELDS} FROM aether_store.branches WHERE tenant=$1 AND document_id=$2 AND id=$3 AND NOT deleted"), &[&scope.tenant, &id, &target]).await.map_err(pg_error)?.as_ref().map(from_row).transpose()?.ok_or_else(not_found)
}

pub(super) async fn lock_operation(
    tx: &tokio_postgres::Transaction<'_>,
    scope: &AuthorizedScope,
    id: &str,
    operation: &str,
) -> Result<()> {
    for (kind, id) in [("operation", operation), ("document", id)] {
        tx.execute(
            "SELECT pg_advisory_xact_lock($1)",
            &[&lock_key(kind, &scope.tenant, id)],
        )
        .await
        .map_err(pg_error)?;
    }
    Ok(())
}
pub(super) async fn next_revision(
    client: &impl GenericClient,
    scope: &AuthorizedScope,
    id: &str,
) -> Result<u32> {
    let highest: i64 = client.query_one("SELECT coalesce(max(revision),0) FROM aether_store.revisions WHERE tenant=$1 AND document_id=$2", &[&scope.tenant, &id]).await.map_err(pg_error)?.get(0);
    u32::try_from(highest)
        .ok()
        .and_then(|n| n.checked_add(1))
        .ok_or_else(|| conflict("Revision limit reached."))
}

type Graph = BTreeMap<u32, DocumentRevision>;
async fn graph(client: &impl GenericClient, scope: &AuthorizedScope, id: &str) -> Result<Graph> {
    let rows = client.query("SELECT metadata,revision FROM aether_store.revisions WHERE tenant=$1 AND document_id=$2 ORDER BY revision LIMIT $3", &[&scope.tenant, &id, &(MAX_GRAPH_REVISIONS+1)]).await.map_err(pg_error)?;
    if rows.len() > MAX_GRAPH_REVISIONS as usize {
        return Err(StoreError::new(
            StoreErrorCode::Busy,
            "Revision graph exceeds the synchronous merge limit.",
        ));
    }
    let mut graph = BTreeMap::new();
    for row in rows {
        let d: DocumentRevision = serde_json::from_value(row.get(0))?;
        if d.document_id != id || i64::from(d.revision) != row.get::<_, i64>(1) {
            return Err(corrupt("Revision graph metadata mismatch."));
        }
        graph.insert(d.revision, d);
    }
    Ok(graph)
}
fn ancestors(graph: &Graph, start: u32) -> Result<BTreeSet<u32>> {
    let mut pending = vec![start];
    let mut seen = BTreeSet::new();
    while let Some(number) = pending.pop() {
        if !seen.insert(number) {
            continue;
        }
        let d = graph
            .get(&number)
            .ok_or_else(|| corrupt("Missing ancestor revision."))?;
        if number > 1 && d.parent_revision.is_none() {
            return Err(corrupt("Missing parent revision."));
        }
        for parent in [d.parent_revision, d.merge_parent_revision]
            .into_iter()
            .flatten()
        {
            if parent == 0 || parent >= number {
                return Err(corrupt("Invalid graph ancestry."));
            }
            pending.push(parent);
        }
    }
    Ok(seen)
}

impl HostedStore {
    pub async fn branches_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        id: &str,
    ) -> Result<Vec<BranchHead>> {
        validate_id(id)?;
        deadlines(tx).await?;
        let mut result = vec![head(tx, scope, id, "Main").await?];
        let rows = tx.query(&format!("SELECT {FIELDS} FROM aether_store.branches WHERE tenant=$1 AND document_id=$2 AND NOT deleted ORDER BY created_unix_ms,id LIMIT $3"), &[&scope.tenant, &id, &(MAX_BRANCHES+1)]).await.map_err(pg_error)?;
        if rows.len() > MAX_BRANCHES as usize {
            return Err(corrupt("Branch limit exceeded."));
        }
        for row in rows {
            result.push(from_row(&row)?);
        }
        Ok(result)
    }

    /// Read-only snapshot of all branch heads, including retained tombstones.
    /// Holds the document's shared lock until the caller commits. Never call
    /// this from a write transaction before acquiring its operation lock.
    pub async fn branch_snapshot_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        id: &str,
    ) -> Result<Vec<BranchHead>> {
        validate_id(id)?;
        deadlines(tx).await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock_shared($1)",
            &[&lock_key("document", &scope.tenant, id)],
        )
        .await
        .map_err(pg_error)?;
        let mut result = vec![head(tx, scope, id, "Main").await?];
        let rows = tx.query(&format!("SELECT {FIELDS} FROM aether_store.branches WHERE tenant=$1 AND document_id=$2 ORDER BY created_unix_ms,id LIMIT $3"), &[&scope.tenant, &id, &(MAX_BRANCHES+1)]).await.map_err(pg_error)?;
        if rows.len() > MAX_BRANCHES as usize {
            return Err(corrupt("Branch limit exceeded."));
        }
        for row in rows {
            result.push(from_row(&row)?);
        }
        Ok(result)
    }

    /// Stable-ID read. Display-name lookups must never select a write target.
    pub async fn read_target_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        id: &str,
        target: &str,
    ) -> Result<StoredDocument> {
        validate_id(id)?;
        deadlines(tx).await?;
        let target = target_head(tx, scope, id, target).await?;
        self.read_in(tx, scope, id, Some(target.head_revision))
            .await
    }

    pub async fn read_branch_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        id: &str,
        branch: &str,
    ) -> Result<StoredDocument> {
        validate_id(id)?;
        deadlines(tx).await?;
        let target = head(tx, scope, id, branch).await?;
        self.read_in(tx, scope, id, Some(target.head_revision))
            .await
    }

    pub async fn mutate_branch(
        &self,
        scope: &AuthorizedScope,
        request: &BranchDocumentMutation,
    ) -> Result<MutationReceipt> {
        let mut client = self.pool.get().await.map_err(pool_error)?;
        let tx = client.transaction().await.map_err(pg_error)?;
        let result = self.mutate_branch_in(&tx, scope, request).await?;
        tx.commit().await.map_err(pg_error)?;
        Ok(result)
    }
    pub async fn mutate_branch_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        request: &BranchDocumentMutation,
    ) -> Result<MutationReceipt> {
        self.mutate_target_in(tx, scope, &request.mutation, Some(&request.branch))
            .await
    }

    pub async fn branch_command(
        &self,
        scope: &AuthorizedScope,
        request: &BranchCommand,
    ) -> Result<BranchReceipt> {
        let mut client = self.pool.get().await.map_err(pool_error)?;
        let tx = client.transaction().await.map_err(pg_error)?;
        let result = self.branch_command_in(&tx, scope, request).await?;
        tx.commit().await.map_err(pg_error)?;
        Ok(result)
    }
    /// Caller reauthorizes editor access even on exact receipt replay. Never
    /// return this result to a client before the enclosing transaction commits.
    pub async fn branch_command_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        request: &BranchCommand,
    ) -> Result<BranchReceipt> {
        validate_id(&request.document_id)?;
        validate_id(&request.operation_id)?;
        if request.actor != scope.actor {
            return Err(StoreError::new(
                StoreErrorCode::InvalidRequest,
                "Mutation actor must match the authorized identity.",
            ));
        }
        let fingerprint = hash(&serde_json::to_vec(&("branch_command", request))?);
        deadlines(tx).await?;
        lock_operation(tx, scope, &request.document_id, &request.operation_id).await?;
        if let Some(row) = tx.query_opt("SELECT fingerprint,receipt FROM aether_store.branch_operations WHERE tenant=$1 AND operation_id=$2", &[&scope.tenant, &request.operation_id]).await.map_err(pg_error)? {
            if row.get::<_,String>(0) != fingerprint { return Err(operation_conflict()); }
            let result: BranchResult = serde_json::from_value(row.get(1))?;
            verify_branch_receipt(tx, scope, &request.operation_id, &request.document_id, &result).await?;
            if let BranchResult::Merge { document, .. } = &result { self.content(scope, document).await?; }
            return Ok(BranchReceipt { result, replayed: true });
        }
        if tx
            .query_opt(
                "SELECT 1 FROM aether_store.operations WHERE tenant=$1 AND operation_id=$2",
                &[&scope.tenant, &request.operation_id],
            )
            .await
            .map_err(pg_error)?
            .is_some()
        {
            return Err(operation_conflict());
        }
        let id = &request.document_id;
        let main = head(tx, scope, id, "Main").await?;
        let (result, event) = match &request.change {
            BranchChange::Create {
                name,
                expected_revision,
                from_revision,
                message,
            } => {
                validate_name(name, false)?;
                if message.chars().count() > 500
                    || message
                        .chars()
                        .any(|c| c.is_control() && c != '\n' && c != '\t')
                {
                    return Err(StoreError::new(
                        StoreErrorCode::InvalidRequest,
                        "Use a branch description up to 500 characters.",
                    ));
                }
                guard(main.head_revision, *expected_revision)?;
                if *from_revision == 0 {
                    return Err(StoreError::new(
                        StoreErrorCode::InvalidRequest,
                        "Source revision must be positive.",
                    ));
                }
                let source = revision(tx, &scope.tenant, id, Some(*from_revision))
                    .await?
                    .ok_or_else(not_found)?;
                self.content(scope, &source).await?;
                ensure_name_free(tx, scope, id, name).await?;
                let count: i64 = tx.query_one("SELECT count(*) FROM aether_store.branches WHERE tenant=$1 AND document_id=$2", &[&scope.tenant, &id]).await.map_err(pg_error)?.get(0);
                if count >= MAX_BRANCHES {
                    return Err(StoreError::new(
                        StoreErrorCode::InvalidRequest,
                        "Branch limit reached; history is retained.",
                    ));
                }
                let branch = BranchHead {
                    id: Some(format!(
                        "branch-{}",
                        hash(&serde_json::to_vec(&(
                            &scope.tenant,
                            id,
                            &request.operation_id
                        ))?)
                    )),
                    name: name.clone(),
                    head_revision: *from_revision,
                    created_from: Some(*from_revision),
                    author: Some(scope.actor.clone()),
                    created_unix_ms: Some(now_ms()?),
                    message: message.clone(),
                    deleted: false,
                };
                tx.execute("INSERT INTO aether_store.branches(tenant,document_id,id,name,head_revision,created_from,actor,created_unix_ms,message,created_operation_id) VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,$9)", &[&scope.tenant, &id, &branch.id, &name, &i64::from(*from_revision), &scope.actor, &branch.created_unix_ms, &message, &request.operation_id]).await.map_err(pg_error)?;
                (BranchResult::Head { branch }, "branch_create")
            }
            BranchChange::Rename {
                branch,
                expected_revision,
                new_name,
            } => {
                if branch == "Main" {
                    return Err(StoreError::new(
                        StoreErrorCode::InvalidRequest,
                        "Main cannot be renamed or deleted.",
                    ));
                }
                validate_name(new_name, false)?;
                let mut b = target_head(tx, scope, id, branch).await?;
                guard(b.head_revision, *expected_revision)?;
                ensure_name_free(tx, scope, id, new_name).await?;
                tx.execute("UPDATE aether_store.branches SET name=$4 WHERE tenant=$1 AND document_id=$2 AND id=$3", &[&scope.tenant, &id, &b.id, &new_name]).await.map_err(pg_error)?;
                b.name = new_name.clone();
                (BranchResult::Head { branch: b }, "branch_rename")
            }
            BranchChange::Delete {
                branch,
                expected_revision,
                expected_main_revision,
                force,
            } => {
                if branch == "Main" {
                    return Err(StoreError::new(
                        StoreErrorCode::InvalidRequest,
                        "Main cannot be renamed or deleted.",
                    ));
                }
                let mut b = target_head(tx, scope, id, branch).await?;
                guard(b.head_revision, *expected_revision)?;
                guard(main.head_revision, *expected_main_revision)?;
                if !force
                    && !ancestors(&graph(tx, scope, id).await?, main.head_revision)?
                        .contains(&b.head_revision)
                {
                    return Err(conflict(
                        "Branch has unmerged work. Merge it or explicitly force deletion.",
                    ));
                }
                tx.execute("UPDATE aether_store.branches SET deleted=true WHERE tenant=$1 AND document_id=$2 AND id=$3", &[&scope.tenant, &id, &b.id]).await.map_err(pg_error)?;
                b.deleted = true;
                (BranchResult::Head { branch: b }, "branch_delete")
            }
            BranchChange::Merge {
                source,
                target,
                expected_source_revision,
                expected_revision,
                resolution,
            } => {
                if source == target {
                    return Err(StoreError::new(
                        StoreErrorCode::InvalidRequest,
                        "Choose two different branches.",
                    ));
                }
                let source = target_head(tx, scope, id, source).await?;
                let target = target_head(tx, scope, id, target).await?;
                guard(source.head_revision, *expected_source_revision)?;
                guard(target.head_revision, *expected_revision)?;
                let graph = graph(tx, scope, id).await?;
                let source_ancestors = ancestors(&graph, source.head_revision)?;
                let target_ancestors = ancestors(&graph, target.head_revision)?;
                let base = source_ancestors
                    .intersection(&target_ancestors)
                    .last()
                    .copied()
                    .ok_or_else(|| corrupt("Branches have no common ancestor."))?;
                let current = graph.get(&target.head_revision).ok_or_else(not_found)?;
                let source_doc = graph.get(&source.head_revision).ok_or_else(not_found)?;
                self.content(scope, current).await?;
                self.content(scope, source_doc).await?;
                if target_ancestors.contains(&source.head_revision) {
                    (
                        BranchResult::Merge {
                            document: current.clone(),
                            merged: false,
                            fast_forward: false,
                            merge_base_revision: base,
                        },
                        "branch_merge_noop",
                    )
                } else {
                    let fast_forward = base == target.head_revision;
                    let take_source = if fast_forward {
                        true
                    } else {
                        match resolution {
                            Some(MergeResolution::Source) => true,
                            Some(MergeResolution::Target) => false,
                            None => {
                                return Err(conflict(
                                    "Both branches changed; explicitly choose source or target content.",
                                ));
                            }
                        }
                    };
                    let selected = if take_source { source_doc } else { current };
                    let synthetic = DocumentMutation {
                        operation_id: request.operation_id.clone(),
                        document_id: id.clone(),
                        actor: scope.actor.clone(),
                        change: DocumentChange::Restore {
                            expected_revision: target.head_revision,
                            source_revision: selected.revision,
                            preserve_name: Some(true),
                        },
                    };
                    let mut prepared = PreparedMutation::new(&synthetic)?;
                    prepared.fingerprint = fingerprint.clone();
                    let mut document = prepared.revision_at(
                        &synthetic,
                        Some(current),
                        Some(selected),
                        next_revision(tx, scope, id).await?,
                    )?;
                    document.branch_id = target.id;
                    document.event = "merge".into();
                    document.restored_from_revision = None;
                    document.merge_parent_revision = Some(source.head_revision);
                    let result = self
                        .persist_revision_in(tx, scope, &prepared, document)
                        .await?;
                    (
                        BranchResult::Merge {
                            document: result.document,
                            merged: true,
                            fast_forward,
                            merge_base_revision: base,
                        },
                        "branch_merge",
                    )
                }
            }
        };
        let saved = now_ms()?;
        let receipt = serde_json::to_value(&result)?;
        tx.execute(
            "INSERT INTO aether_store.branch_operations VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
            &[
                &scope.tenant,
                &request.operation_id,
                &id,
                &scope.actor,
                &fingerprint,
                &receipt,
                &event,
                &saved,
            ],
        )
        .await
        .map_err(pg_error)?;
        tx.execute(
            "INSERT INTO aether_store.branch_audit VALUES($1,$2,$3,$4,$5,$6)",
            &[
                &scope.tenant,
                &request.operation_id,
                &id,
                &scope.actor,
                &event,
                &saved,
            ],
        )
        .await
        .map_err(pg_error)?;
        Ok(BranchReceipt {
            result,
            replayed: false,
        })
    }
}

async fn ensure_name_free(
    client: &impl GenericClient,
    scope: &AuthorizedScope,
    id: &str,
    name: &str,
) -> Result<()> {
    if client.query_opt("SELECT 1 FROM aether_store.branches WHERE tenant=$1 AND document_id=$2 AND name=$3 AND NOT deleted", &[&scope.tenant, &id, &name]).await.map_err(pg_error)?.is_some() { return Err(conflict("Branch name already exists.")); }
    Ok(())
}

async fn verify_branch_receipt(
    client: &impl GenericClient,
    scope: &AuthorizedScope,
    operation: &str,
    id: &str,
    result: &BranchResult,
) -> Result<()> {
    if client.query_opt("SELECT 1 FROM aether_store.branch_operations o JOIN aether_store.branch_audit a USING(tenant,operation_id,document_id,actor,event,saved_unix_ms) WHERE o.tenant=$1 AND o.operation_id=$2 AND o.document_id=$3", &[&scope.tenant, &operation, &id]).await.map_err(pg_error)?.is_none() { return Err(corrupt("Missing branch receipt/audit.")); }
    match result {
        BranchResult::Head { branch } => {
            let Some(branch_id) = &branch.id else {
                return Err(corrupt("Missing branch identity in receipt."));
            };
            let row = client.query_opt("SELECT created_from,actor,created_unix_ms,message FROM aether_store.branches WHERE tenant=$1 AND document_id=$2 AND id=$3", &[&scope.tenant, &id, &branch_id]).await.map_err(pg_error)?.ok_or_else(|| corrupt("Missing branch identity."))?;
            if branch.created_from.map(i64::from) != Some(row.get(0))
                || branch.author.as_ref() != Some(&row.get::<_, String>(1))
                || branch.created_unix_ms != Some(row.get(2))
                || branch.message != row.get::<_, String>(3)
                || revision(client, &scope.tenant, id, Some(branch.head_revision))
                    .await?
                    .is_none()
            {
                return Err(corrupt(
                    "Branch receipt does not match its identity/history.",
                ));
            }
        }
        BranchResult::Merge {
            document,
            merge_base_revision,
            merged,
            ..
        } => {
            if document.document_id != id
                || revision(client, &scope.tenant, id, Some(document.revision))
                    .await?
                    .as_ref()
                    != Some(document)
                || *merge_base_revision == 0
                || *merge_base_revision > document.revision
                || (*merged && (document.operation_id != operation || document.event != "merge"))
            {
                return Err(corrupt("Merge receipt mismatch."));
            }
            verify_commit(client, &scope.tenant, document).await?;
        }
    }
    Ok(())
}

pub(super) async fn verify_branches(
    client: &impl GenericClient,
    scope: &AuthorizedScope,
    id: &str,
    highest: u32,
) -> Result<()> {
    for row in client
        .query(
            &format!(
                "SELECT {FIELDS},created_operation_id FROM aether_store.branches WHERE tenant=$1 AND document_id=$2"
            ),
            &[&scope.tenant, &id],
        )
        .await
        .map_err(pg_error)?
    {
        let branch = from_row(&row)?;
        let creation: String = row.get(8);
        if client.query_opt("SELECT 1 FROM aether_store.branch_operations WHERE tenant=$1 AND operation_id=$2 AND document_id=$3 AND event='branch_create' AND receipt->'branch'->>'id'=$4", &[&scope.tenant, &creation, &id, &branch.id]).await.map_err(pg_error)?.is_none() { return Err(corrupt("Missing branch creation receipt.")); }
        let newest: Option<i64> = client.query_one("SELECT max(revision) FROM aether_store.revisions WHERE tenant=$1 AND document_id=$2 AND metadata->>'branch_id'=$3", &[&scope.tenant, &id, &branch.id]).await.map_err(pg_error)?.get(0);
        if newest.or(branch.created_from.map(i64::from)) != Some(i64::from(branch.head_revision)) { return Err(corrupt("Branch does not point at its latest revision.")); }
        if branch.head_revision > highest
            || branch.created_from.is_none_or(|r| r > branch.head_revision)
        {
            return Err(corrupt("Invalid branch head."));
        }
        let document = revision(client, &scope.tenant, id, Some(branch.head_revision))
            .await?
            .ok_or_else(|| corrupt("Missing branch head."))?;
        // A just-created branch points at its fork revision; after editing it
        // points at a revision carrying this stable identity.
        if Some(branch.head_revision) != branch.created_from && document.branch_id != branch.id {
            return Err(corrupt("Branch head identity mismatch."));
        }
    }
    let rows = client.query("SELECT operation_id,receipt FROM aether_store.branch_operations WHERE tenant=$1 AND document_id=$2", &[&scope.tenant, &id]).await.map_err(pg_error)?;
    let audits: i64 = client
        .query_one(
            "SELECT count(*) FROM aether_store.branch_audit WHERE tenant=$1 AND document_id=$2",
            &[&scope.tenant, &id],
        )
        .await
        .map_err(pg_error)?
        .get(0);
    if rows.len() as i64 != audits {
        return Err(corrupt("Branch receipt/audit counts differ."));
    }
    for row in rows {
        verify_branch_receipt(
            client,
            scope,
            &row.get::<_, String>(0),
            id,
            &serde_json::from_value(row.get(1))?,
        )
        .await?;
    }
    let main = revision(client, &scope.tenant, id, None)
        .await?
        .ok_or_else(not_found)?;
    let latest_main: Option<i64> = client.query_one("SELECT max(revision) FROM aether_store.revisions WHERE tenant=$1 AND document_id=$2 AND metadata->>'branch_id' IS NULL", &[&scope.tenant, &id]).await.map_err(pg_error)?.get(0);
    if latest_main != Some(i64::from(main.revision)) {
        return Err(corrupt("Main does not point at its latest revision."));
    }
    if main.branch_id.is_some() {
        return Err(corrupt("Main points at another branch's revision."));
    }
    Ok(())
}
