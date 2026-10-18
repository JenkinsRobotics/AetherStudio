//! Read-only compatibility for comparing immutable branch snapshots. Product
//! geometry is never evaluated here; JSON features are opaque saved records.
use super::*;
use std::collections::{BTreeMap, BTreeSet};

impl Documents {
    pub(super) async fn library_compare(&self, token: &str, input: &Request) -> Result<Value> {
        tokio::time::timeout(
            std::time::Duration::from_secs(10),
            self.compare_inner(token, input),
        )
        .await
        .map_err(|_| Error::Unavailable)?
    }

    async fn compare_inner(&self, token: &str, input: &Request) -> Result<Value> {
        let Request::Compare {
            app,
            id,
            from,
            to,
            branch,
        } = input
        else {
            return Err(Error::Invalid);
        };
        let target = branch_target(branch)?;
        if !valid_id(id) || *from == 0 || *to == 0 {
            return Err(Error::Invalid);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.identity.authorize_transaction(&tx, token).await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        self.app(&tx, &user, app).await?;
        let resource = self.require(&tx, &user, id, Role::Viewer).await?;
        if resource.app != *app || resource.kind != "document" {
            return Err(Error::Denied);
        }
        if app == "drive" {
            return Err(Error::Unsupported);
        }
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        let heads = self.store.branch_snapshot_in(&tx, &scope, id).await?;
        if !heads
            .iter()
            .any(|h| !h.deleted && h.id.as_deref().unwrap_or("Main") == target)
        {
            return Err(Error::Denied);
        }
        let latest = heads
            .iter()
            .map(|h| h.head_revision)
            .max()
            .ok_or(Error::Incompatible)?;
        if *from > latest || *to > latest {
            return Err(Error::Denied);
        }
        let rows = self
            .history_projection(&tx, &scope, id, app, latest)
            .await?;
        let parents: BTreeMap<u32, Vec<u32>> = rows
            .iter()
            .map(|r| {
                let n = u32::try_from(r["revision"].as_u64().ok_or(Error::Incompatible)?)
                    .map_err(|_| Error::Incompatible)?;
                let mut parents = Vec::new();
                for key in ["parent_revision", "merge_parent_revision"] {
                    if !r[key].is_null() {
                        let p = u32::try_from(r[key].as_u64().ok_or(Error::Incompatible)?)
                            .map_err(|_| Error::Incompatible)?;
                        if p == 0 || p >= n || parents.contains(&p) {
                            return Err(Error::Incompatible);
                        }
                        parents.push(p);
                    }
                }
                Ok((n, parents))
            })
            .collect::<Result<_>>()?;
        let ancestors = |tip| -> Result<BTreeSet<u32>> {
            let mut found = BTreeSet::new();
            let mut pending = vec![tip];
            while let Some(n) = pending.pop() {
                if !found.insert(n) {
                    continue;
                }
                pending.extend(parents.get(&n).ok_or(Error::Incompatible)?);
            }
            Ok(found)
        };
        let left = ancestors(*from)?;
        let right = ancestors(*to)?;
        let base = left.intersection(&right).last().copied();
        let common = base.map(ancestors).transpose()?.unwrap_or_default();
        let path = |side: &BTreeSet<u32>| -> Vec<Value> {
            rows.iter().filter(|r| {
                let n = r["revision"].as_u64().unwrap() as u32;
                side.contains(&n) && !common.contains(&n)
            }).map(|r| json!({"revision":r["revision"],"saved":r["saved"],"event":r["event"],"note":r["note"],"branch":r["branch"],"author":r["author"]})).collect()
        };
        let a = self.store.read_in(&tx, &scope, id, Some(*from)).await?;
        let b = self.store.read_in(&tx, &scope, id, Some(*to)).await?;
        let a = STANDARD
            .decode(a.content_base64)
            .map_err(|_| Error::Incompatible)?;
        let b = STANDARD
            .decode(b.content_base64)
            .map_err(|_| Error::Incompatible)?;
        let result = json!({"from":from,"to":to,"base":base,"same_content":a==b,
            "from_only":path(&left),"to_only":path(&right),
            "content_diff":content_diff(&a,&b),"features":feature_diff(&a,&b)});
        commit(tx).await?;
        Ok(result)
    }
}

fn feature_diff(a: &[u8], b: &[u8]) -> Option<Value> {
    // Match the existing structural summary without a CAD/kernel dependency.
    // Large saved documents retain byte comparison and downloadable revisions.
    if a.len().max(b.len()) > 200_000 {
        return None;
    }
    let a: Value = serde_json::from_slice(a).ok()?;
    let b: Value = serde_json::from_slice(b).ok()?;
    let collect = |v: &Value| -> Option<BTreeMap<String, Value>> {
        Some(
            v.get("features")?
                .as_array()?
                .iter()
                .filter_map(|f| {
                    let id = f.get("id")?.as_str()?;
                    (!id.is_empty()).then(|| (id.to_owned(), f.clone()))
                })
                .collect(),
        )
    };
    let a = collect(&a)?;
    let b = collect(&b)?;
    let item = |(id, f): (&String, &Value)| json!({"id":id,"name":f.get("name").filter(|v| v.as_str().is_some_and(|s| !s.is_empty())).or_else(|| f.get("type")).unwrap_or(&json!("feature"))});
    Some(json!({
        "added":b.iter().filter(|(id,_)| !a.contains_key(*id)).map(item).collect::<Vec<_>>(),
        "removed":a.iter().filter(|(id,_)| !b.contains_key(*id)).map(item).collect::<Vec<_>>(),
        "changed":b.iter().filter(|(id,f)| a.get(*id).is_some_and(|old| old != *f)).map(item).collect::<Vec<_>>()
    }))
}

fn content_diff(a: &[u8], b: &[u8]) -> Value {
    if a == b {
        return json!({"kind":"identical","text":"","truncated":false});
    }
    if a.len().max(b.len()) > 200_000 {
        return json!({"kind":"large","text":"Download revisions to compare this large file.","truncated":false});
    }
    let text = |bytes: &[u8]| -> Option<String> {
        let s = std::str::from_utf8(bytes).ok()?;
        if s.contains('\0') {
            return None;
        }
        Some(
            serde_json::from_str::<Value>(s)
                .ok()
                .and_then(|v| serde_json::to_string_pretty(&v).ok())
                .unwrap_or_else(|| s.to_owned()),
        )
    };
    let (Some(a), Some(b)) = (text(a), text(b)) else {
        return json!({"kind":"binary","text":"Binary content changed. Download revisions to inspect.","truncated":false});
    };
    let a: Vec<_> = a.lines().collect();
    let b: Vec<_> = b.lines().collect();
    // Linear bounded comparison: one replacement hunk, with three context lines.
    // It intentionally favors predictable work over a quadratic minimal diff.
    let prefix = a.iter().zip(&b).take_while(|(a, b)| a == b).count();
    let suffix = a[prefix..]
        .iter()
        .rev()
        .zip(b[prefix..].iter().rev())
        .take_while(|(a, b)| a == b)
        .count();
    let mut output = String::new();
    let mut count = 0;
    let mut truncated = false;
    let mut emit = |line: String| {
        if truncated {
            return;
        }
        if count >= 500 || output.chars().count() + line.chars().count() + 1 > 30_000 {
            truncated = true;
            return;
        }
        if count > 0 {
            output.push('\n');
        }
        output.push_str(&line);
        count += 1;
    };
    if a != b {
        let start = prefix.saturating_sub(3);
        let aend = (a.len() - suffix + 3).min(a.len());
        let bend = (b.len() - suffix + 3).min(b.len());
        emit("--- Selected revision".into());
        emit("+++ Compared revision".into());
        emit(format!(
            "@@ -{},{} +{},{} @@",
            if aend > start { start + 1 } else { start },
            aend - start,
            if bend > start { start + 1 } else { start },
            bend - start
        ));
        for line in &a[start..prefix] {
            emit(format!(" {line}"));
        }
        for line in &a[prefix..a.len() - suffix] {
            emit(format!("-{line}"));
        }
        for line in &b[prefix..b.len() - suffix] {
            emit(format!("+{line}"));
        }
        for line in &a[a.len() - suffix..aend] {
            emit(format!(" {line}"));
        }
    }
    json!({"kind":"text","text":output,"truncated":truncated})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounded_text_and_opaque_feature_reports() {
        assert_eq!(content_diff(b"a", b"a")["kind"], "identical");
        assert_eq!(content_diff(b"\0", b"a")["kind"], "binary");
        assert_eq!(content_diff(&vec![b'a'; 200_001], b"b")["kind"], "large");
        let r = content_diff("one\nété\nthree".as_bytes(), "one\n二\nthree".as_bytes());
        assert!(r["text"].as_str().unwrap().contains("-été\n+二"));
        assert_eq!(r["truncated"], false);
        assert_eq!(
            content_diff(b"", b"a")["text"],
            "--- Selected revision\n+++ Compared revision\n@@ -0,0 +1,1 @@\n+a"
        );
        let many = (0..1000).map(|n| format!("{n}\n")).collect::<String>();
        let r = content_diff(many.as_bytes(), b"new");
        assert_eq!(r["truncated"], true);
        assert!(r["text"].as_str().unwrap().lines().count() <= 500);
        let r = feature_diff(
            br#"{"features":[{"id":"a","name":"Old"},{"id":"b"}]}"#,
            br#"{"features":[{"id":"a","name":"New"},{"id":"c","type":"pad"}]}"#,
        )
        .unwrap();
        assert_eq!(r["changed"], json!([{"id":"a","name":"New"}]));
        assert_eq!(r["removed"][0]["id"], "b");
        assert_eq!(r["added"][0]["name"], "pad");
    }
}
