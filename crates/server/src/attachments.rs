//! Operator-loaded private attachment snapshot, distinct from public frontends.
//! Bounded and immutable: slow clients share Bytes rather than accumulating file
//! copies. Refresh requires a new host snapshot; this is not the upload service.
use axum::body::Bytes;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, path::Path, sync::Arc};

const INVALID: &str = "Invalid private attachment snapshot.";
const MAX_FILE: usize = 64 * 1024 * 1024;
const MAX_TOTAL: usize = 128 * 1024 * 1024;
const MAX_ENTRIES: usize = 4096;
#[derive(Clone)]
pub struct Attachments(Arc<BTreeMap<String, Bytes>>);
impl Attachments {
    pub(crate) fn backup_entries(&self) -> impl Iterator<Item = (String, Vec<u8>)> + '_ {
        self.0
            .iter()
            .map(|(key, value)| (format!("attachments/{key}"), value.to_vec()))
    }

    /// The configured directory belongs to this host's tenant. No client chooses
    /// a path. Only hash-named regular files are admitted; reject any extra entry.
    #[cfg(unix)]
    pub fn load(path: &Path) -> Result<Self, &'static str> {
        use rustix::fs::{Dir, FileType, Mode, OFlags, open, openat};
        use std::{fs::File, io::Read};
        let root = File::from(
            open(
                path,
                OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                Mode::empty(),
            )
            .map_err(|_| INVALID)?,
        );
        let mut files = BTreeMap::new();
        let mut total = 0usize;
        for entry in Dir::read_from(&root).map_err(|_| INVALID)? {
            let entry = entry.map_err(|_| INVALID)?;
            let name = entry.file_name().to_str().map_err(|_| INVALID)?;
            if matches!(name, "." | "..") {
                continue;
            }
            if !valid_digest(name)
                || entry.file_type() != FileType::RegularFile
                || files.len() >= MAX_ENTRIES
            {
                return Err(INVALID);
            }
            let file = File::from(
                openat(
                    &root,
                    name,
                    OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::NONBLOCK | OFlags::CLOEXEC,
                    Mode::empty(),
                )
                .map_err(|_| INVALID)?,
            );
            let meta = file.metadata().map_err(|_| INVALID)?;
            if !meta.is_file()
                || meta.len() > MAX_FILE as u64
                || meta.len() > (MAX_TOTAL - total) as u64
            {
                return Err(INVALID);
            }
            let mut bytes = Vec::new();
            file.take((MAX_FILE.min(MAX_TOTAL - total) + 1) as u64)
                .read_to_end(&mut bytes)
                .map_err(|_| INVALID)?;
            total = total.checked_add(bytes.len()).ok_or(INVALID)?;
            if bytes.len() > MAX_FILE
                || total > MAX_TOTAL
                || format!("{:x}", Sha256::digest(&bytes)) != name
            {
                return Err(INVALID);
            }
            if files.insert(name.to_string(), Bytes::from(bytes)).is_some() {
                return Err(INVALID);
            }
        }
        Ok(Self(Arc::new(files)))
    }
    #[cfg(not(unix))]
    pub fn load(_: &Path) -> Result<Self, &'static str> {
        Err("Private attachment snapshots are currently qualified on Unix only.")
    }
    pub(crate) fn get(&self, digest: &str, size: u64) -> Option<Bytes> {
        self.0
            .get(digest)
            .filter(|bytes| bytes.len() as u64 == size)
            .cloned()
    }
}
pub(crate) fn valid_digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::{fs, os::unix::fs::symlink};
    #[test]
    fn snapshot_verifies_content_and_never_follows_changed_files() {
        let root = tempfile::tempdir().unwrap();
        let sha = format!("{:x}", Sha256::digest(b"fixture"));
        let path = root.path().join(&sha);
        fs::write(&path, b"fixture").unwrap();
        let snapshot = Attachments::load(root.path()).unwrap();
        fs::write(&path, b"changed").unwrap();
        assert_eq!(snapshot.get(&sha, 7).unwrap(), &b"fixture"[..]);
        assert!(snapshot.get(&sha, 8).is_none());
        assert!(snapshot.get("../fixture", 7).is_none());
        assert!(Attachments::load(root.path()).is_err());
    }
    #[test]
    fn refuses_symlinks_extra_entries_and_sparse_oversize_without_loading_them() {
        let root = tempfile::tempdir().unwrap();
        let sha = format!("{:x}", Sha256::digest(b"fixture"));
        let external = tempfile::NamedTempFile::new().unwrap();
        fs::write(external.path(), b"fixture").unwrap();
        symlink(external.path(), root.path().join(&sha)).unwrap();
        assert!(Attachments::load(root.path()).is_err());
        fs::remove_file(root.path().join(&sha)).unwrap();
        fs::File::create(root.path().join(&sha))
            .unwrap()
            .set_len(MAX_FILE as u64 + 1)
            .unwrap();
        assert!(Attachments::load(root.path()).is_err());
        fs::remove_file(root.path().join(&sha)).unwrap();
        fs::write(root.path().join("secret.txt"), b"not an attachment").unwrap();
        assert!(Attachments::load(root.path()).is_err());
        let link = root.path().join("linked-root");
        symlink(root.path(), &link).unwrap();
        assert!(Attachments::load(&link).is_err());
    }
}
