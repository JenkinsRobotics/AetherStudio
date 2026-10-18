//! Private per-user legacy workspace snapshots. No request opens a filesystem path.
//! This read adapter is distinct from app builds and Studio document/attachment IDs.
use axum::body::Bytes;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, path::Path, sync::Arc};

const INVALID: &str = "Invalid private workspace snapshot.";
const MAX_FILE: usize = 64 * 1024 * 1024;
const MAX_TOTAL: usize = 128 * 1024 * 1024;
const MAX_ENTRIES: usize = 10_000;
#[derive(Clone)]
pub(crate) struct Asset {
    pub bytes: Bytes,
    pub revision: String,
}
#[derive(Clone)]
pub struct WorkspaceAssets(Arc<BTreeMap<String, Asset>>);

fn segment(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 255
        && !matches!(value, "." | "..")
        && !value.contains(['/', '\\', '%'])
        && !value.chars().any(char::is_control)
}
pub(crate) fn relative(value: &str) -> bool {
    !value.is_empty() && value.len() <= 4096 && value.split('/').all(segment)
}
impl WorkspaceAssets {
    pub(crate) fn backup_entries(&self) -> impl Iterator<Item = (String, Vec<u8>)> + '_ {
        self.0
            .iter()
            .map(|(key, value)| (format!("workspaces/{key}"), value.bytes.to_vec()))
    }

    /// Root layout: USER_ID/relative/path. It belongs to this host's tenant.
    /// Snapshot contents are immutable until the operator explicitly reloads them.
    #[cfg(unix)]
    pub fn load(path: &Path) -> Result<Self, &'static str> {
        use rustix::fs::{Mode, OFlags, open};
        let root = std::fs::File::from(
            open(
                path,
                OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                Mode::empty(),
            )
            .map_err(|_| INVALID)?,
        );
        let mut snapshot = Builder::default();
        snapshot.walk(&root, "", 0)?;
        Ok(Self(Arc::new(snapshot.files)))
    }
    #[cfg(not(unix))]
    pub fn load(_: &Path) -> Result<Self, &'static str> {
        Err("Private workspace snapshots are currently qualified on Unix only.")
    }
    pub(crate) fn get(&self, user: &str, path: &str) -> Option<Asset> {
        if !segment(user) || !relative(path) {
            return None;
        }
        self.0.get(&format!("{user}/{path}")).cloned()
    }
}

#[cfg(unix)]
#[derive(Default)]
struct Builder {
    files: BTreeMap<String, Asset>,
    total: usize,
    entries: usize,
}
#[cfg(unix)]
impl Builder {
    fn walk(
        &mut self,
        dir: &std::fs::File,
        prefix: &str,
        depth: usize,
    ) -> Result<(), &'static str> {
        use rustix::fs::{Dir, FileType, Mode, OFlags, openat};
        use std::{fs::File, io::Read};
        if depth > 32 {
            return Err(INVALID);
        }
        for entry in Dir::read_from(dir).map_err(|_| INVALID)? {
            let entry = entry.map_err(|_| INVALID)?;
            let name = entry.file_name().to_str().map_err(|_| INVALID)?;
            if matches!(name, "." | "..") {
                continue;
            }
            self.entries += 1;
            if !segment(name) || self.entries > MAX_ENTRIES {
                return Err(INVALID);
            }
            let kind = entry.file_type();
            if !matches!(kind, FileType::RegularFile | FileType::Directory)
                || (depth == 0 && kind != FileType::Directory)
            {
                return Err(INVALID);
            }
            let key = if prefix.is_empty() {
                name.to_string()
            } else {
                format!("{prefix}/{name}")
            };
            if key.len() > 4096 {
                return Err(INVALID);
            }
            let mut flags = OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::NONBLOCK | OFlags::CLOEXEC;
            if kind == FileType::Directory {
                flags |= OFlags::DIRECTORY;
            }
            let child = File::from(openat(dir, name, flags, Mode::empty()).map_err(|_| INVALID)?);
            if kind == FileType::Directory {
                self.walk(&child, &key, depth + 1)?;
            } else {
                let meta = child.metadata().map_err(|_| INVALID)?;
                let limit = MAX_FILE.min(MAX_TOTAL - self.total);
                if !meta.is_file() || meta.len() > limit as u64 {
                    return Err(INVALID);
                }
                let mut bytes = Vec::new();
                child
                    .take(limit as u64 + 1)
                    .read_to_end(&mut bytes)
                    .map_err(|_| INVALID)?;
                if bytes.len() > limit {
                    return Err(INVALID);
                }
                self.total += bytes.len();
                let revision = format!("{:x}", Sha256::digest(&bytes));
                if self
                    .files
                    .insert(
                        key,
                        Asset {
                            bytes: Bytes::from(bytes),
                            revision,
                        },
                    )
                    .is_some()
                {
                    return Err(INVALID);
                }
            }
        }
        Ok(())
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::{fs, os::unix::fs::symlink};
    #[test]
    fn user_paths_are_isolated_and_snapshot_survives_source_changes() {
        let root = tempfile::tempdir().unwrap();
        for user in ["alice", "bob"] {
            fs::create_dir_all(root.path().join(user).join("models")).unwrap();
            fs::write(root.path().join(user).join("models/π mesh.stl"), user).unwrap();
        }
        let snapshot = WorkspaceAssets::load(root.path()).unwrap();
        fs::remove_dir_all(root.path().join("alice")).unwrap();
        let asset = snapshot.get("alice", "models/π mesh.stl").unwrap();
        assert_eq!(asset.bytes, "alice");
        assert_eq!(asset.revision, format!("{:x}", Sha256::digest(b"alice")));
        assert_eq!(
            snapshot.get("bob", "models/π mesh.stl").unwrap().bytes,
            "bob"
        );
        for path in [
            "../bob/models/π mesh.stl",
            "/models/file",
            "models//file",
            "models/%2e%2e/file",
            "models/./file",
            "models/\\file",
            "models/\0file",
        ] {
            assert!(snapshot.get("alice", path).is_none());
        }
        assert!(snapshot.get("alice/../bob", "models/π mesh.stl").is_none());
    }
    #[test]
    fn unsafe_trees_and_sparse_oversize_refuse_startup() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("alice")).unwrap();
        let file = root.path().join("alice/file");
        symlink("/etc/passwd", &file).unwrap();
        assert!(WorkspaceAssets::load(root.path()).is_err());
        fs::remove_file(&file).unwrap();
        fs::File::create(&file)
            .unwrap()
            .set_len(MAX_FILE as u64 + 1)
            .unwrap();
        assert!(WorkspaceAssets::load(root.path()).is_err());
        fs::remove_file(&file).unwrap();
        fs::write(root.path().join("orphan.txt"), "no owner").unwrap();
        assert!(WorkspaceAssets::load(root.path()).is_err());
        fs::remove_file(root.path().join("orphan.txt")).unwrap();
        let link = root.path().join("linked-root");
        symlink(root.path(), &link).unwrap();
        assert!(WorkspaceAssets::load(&link).is_err());
        assert!(WorkspaceAssets::load(root.path()).is_err());
    }
}
