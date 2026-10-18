//! Studio-owned provider state. Never part of a document or normal content backup.
use super::{Error, Result};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
};

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Settings {
    pub installed: bool,
    pub enabled: bool,
}
#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(super) struct Account {
    pub connected: bool,
    pub label: String,
    pub verified_at: u64,
}
pub(super) struct Storage {
    pub root: PathBuf,
    _lock: File,
}
fn unavailable<T>(_: T) -> Error {
    Error::Unavailable
}
fn digest(value: &str) -> String {
    format!("{:x}", Sha256::digest(value))
}

pub(super) fn private_dir(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::{DirBuilderExt, PermissionsExt};
        match fs::DirBuilder::new().mode(0o700).create(path) {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => (),
            Err(_) => return Err(Error::Unavailable),
        }
        let meta = fs::symlink_metadata(path).map_err(unavailable)?;
        if !meta.is_dir() || meta.permissions().mode() & 0o077 != 0 {
            return Err(Error::Unavailable);
        }
        Ok(())
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Err(Error::Unsupported)
    }
}
impl Storage {
    pub fn open(root: &Path, tenant: &str) -> Result<Self> {
        if !root.is_absolute() {
            return Err(Error::Invalid);
        }
        private_dir(root)?;
        let root = root.join(digest(tenant));
        private_dir(&root)?;
        let path = root.join("owner.lock");
        let mut opts = OpenOptions::new();
        opts.read(true).write(true).create(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            opts.mode(0o600)
                .custom_flags(rustix::fs::OFlags::NOFOLLOW.bits() as i32);
        }
        let lock = opts.open(path).map_err(unavailable)?;
        lock.try_lock().map_err(unavailable)?;
        for provider in super::PROVIDERS {
            private_dir(&root.join(account_folder(provider)))?;
        }
        Ok(Self { root, _lock: lock })
    }
    pub fn account_dir(&self, user: &str, provider: &str) -> PathBuf {
        self.root.join(account_folder(provider)).join(digest(user))
    }
    pub fn settings(&self, provider: &str) -> Result<Settings> {
        read(&self.root.join(settings_file(provider)))
    }
    pub fn save_settings(&self, provider: &str, value: &Settings) -> Result<()> {
        write(&self.root.join(settings_file(provider)), value)
    }
    pub fn account(&self, user: &str, provider: &str) -> Result<Account> {
        read(&self.account_dir(user, provider).join("connection.json"))
    }
    pub fn clear_account(&self, user: &str, provider: &str) -> Result<()> {
        let dir = self.account_dir(user, provider);
        if dir.exists() {
            private_dir(&dir)?;
            fs::remove_dir_all(dir).map_err(unavailable)?;
        }
        Ok(())
    }
    pub fn clear_accounts(&self, provider: &str) -> Result<()> {
        for entry in fs::read_dir(self.root.join(account_folder(provider))).map_err(unavailable)? {
            let entry = entry.map_err(unavailable)?;
            private_dir(&entry.path())?;
            fs::remove_dir_all(entry.path()).map_err(unavailable)?;
        }
        Ok(())
    }
}
// Keep the original ChatGPT storage layout. Provider directories are siblings,
// so disconnecting or uninstalling one cannot remove another's credentials.
fn account_folder(provider: &str) -> &'static str {
    match provider {
        "chatgpt" => "accounts",
        "claude" => "accounts-claude",
        "gemini" => "accounts-gemini",
        _ => unreachable!("validated provider"),
    }
}
fn settings_file(provider: &str) -> &'static str {
    match provider {
        "chatgpt" => "plugins.json",
        "claude" => "plugins-claude.json",
        "gemini" => "plugins-gemini.json",
        _ => unreachable!("validated provider"),
    }
}
pub(super) fn read<T: DeserializeOwned + Default>(path: &Path) -> Result<T> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(rustix::fs::OFlags::NOFOLLOW.bits() as i32);
    }
    let file = match options.open(path) {
        Ok(file) => file,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(T::default()),
        Err(_) => return Err(Error::Unavailable),
    };
    let meta = file.metadata().map_err(unavailable)?;
    if !meta.is_file() || meta.len() > 8192 {
        return Err(Error::Unavailable);
    }
    let mut bytes = Vec::new();
    file.take(8193)
        .read_to_end(&mut bytes)
        .map_err(unavailable)?;
    if bytes.len() > 8192 {
        return Err(Error::Unavailable);
    }
    serde_json::from_slice(&bytes).map_err(unavailable)
}
pub(super) fn write<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    let parent = path.parent().ok_or(Error::Invalid)?;
    private_dir(parent)?;
    let bytes = serde_json::to_vec(value).map_err(unavailable)?;
    let mut staged = tempfile::NamedTempFile::new_in(parent).map_err(unavailable)?;
    staged.write_all(&bytes).map_err(unavailable)?;
    staged.as_file().sync_all().map_err(unavailable)?;
    staged.persist(path).map_err(unavailable)?;
    File::open(parent)
        .and_then(|f| f.sync_all())
        .map_err(|_| Error::OutcomeUnknown)
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::{PermissionsExt, symlink};
    #[test]
    fn private_storage_does_not_follow_settings_links_or_repair_corrupt_state() {
        let root = tempfile::tempdir().unwrap();
        let store = Storage::open(&root.path().join("agents"), "tenant").unwrap();
        store
            .save_settings(
                "chatgpt",
                &Settings {
                    installed: true,
                    enabled: true,
                },
            )
            .unwrap();
        let path = store.root.join("plugins.json");
        assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o077, 0);
        fs::write(&path, b"{broken").unwrap();
        assert!(store.settings("chatgpt").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"{broken");
        fs::remove_file(&path).unwrap();
        let outside = root.path().join("other.json");
        fs::write(&outside, b"{}").unwrap();
        symlink(&outside, &path).unwrap();
        assert!(store.settings("chatgpt").is_err());
        assert_eq!(fs::read(&outside).unwrap(), b"{}");
    }
    #[test]
    fn storage_requires_private_root_and_separates_tenants() {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("agents");
        fs::create_dir(&dir).unwrap();
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(Storage::open(&dir, "tenant").is_err());
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o700)).unwrap();
        let first = Storage::open(&dir, "one").unwrap();
        let second = Storage::open(&dir, "two").unwrap();
        first
            .save_settings(
                "chatgpt",
                &Settings {
                    installed: true,
                    enabled: true,
                },
            )
            .unwrap();
        assert!(!second.settings("chatgpt").unwrap().installed);
        assert_ne!(
            first.account_dir("same", "chatgpt"),
            second.account_dir("same", "chatgpt")
        );
    }
}
