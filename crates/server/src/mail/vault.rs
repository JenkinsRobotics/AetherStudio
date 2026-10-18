//! Immutable random-named secrets. Publish and fsync before SQL references them;
//! a failed settings transaction may leave an unreferenced secret, never a
//! partially configured password. Normal document/SQL backups exclude this root.
use crate::settings::{Error, Result};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
};
use zeroize::Zeroizing;
#[derive(Clone)]
pub struct Vault(Arc<PathBuf>);
fn unavailable<T>(_: T) -> Error {
    Error::Unavailable
}
impl Vault {
    pub fn open(path: &Path, tenant: &str) -> Result<Self> {
        if !path.is_absolute() {
            return Err(Error::Invalid);
        }
        private_dir(path)?;
        use sha2::{Digest, Sha256};
        let path = path.join(format!("{:x}", Sha256::digest(tenant)));
        private_dir(&path)?;
        Ok(Self(Arc::new(path)))
    }
    pub async fn put(&self, password: &str) -> Result<String> {
        if password.len() > 4096 {
            return Err(Error::Invalid);
        }
        let root = self.0.clone();
        let bytes = Zeroizing::new(password.as_bytes().to_vec());
        tokio::task::spawn_blocking(move || {
            private_dir(&root)?;
            let mut random = [0u8; 32];
            getrandom::fill(&mut random).map_err(unavailable)?;
            let id = random
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>();
            let mut staged = tempfile::NamedTempFile::new_in(&*root).map_err(unavailable)?;
            staged.write_all(&bytes).map_err(unavailable)?;
            staged.as_file().sync_all().map_err(unavailable)?;
            staged
                .persist_noclobber(root.join(&id))
                .map_err(unavailable)?;
            File::open(&*root)
                .and_then(|f| f.sync_all())
                .map_err(unavailable)?;
            Ok(id)
        })
        .await
        .map_err(unavailable)?
    }
    pub async fn get(&self, id: &str) -> Result<Zeroizing<String>> {
        if id.len() != 64 || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(Error::Invalid);
        }
        let path = self.0.join(id);
        let root = self.0.clone();
        tokio::task::spawn_blocking(move || {
            private_dir(&root)?;
            let mut options = OpenOptions::new();
            options.read(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.custom_flags(rustix::fs::OFlags::NOFOLLOW.bits() as i32);
            }
            let file = options.open(path).map_err(unavailable)?;
            let meta = file.metadata().map_err(unavailable)?;
            if !meta.is_file() || meta.len() > 4096 {
                return Err(Error::Unavailable);
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if meta.permissions().mode() & 0o077 != 0 {
                    return Err(Error::Unavailable);
                }
            }
            let mut text = Zeroizing::new(String::new());
            file.take(4097)
                .read_to_string(&mut text)
                .map_err(unavailable)?;
            if text.len() > 4096 {
                return Err(Error::Unavailable);
            }
            Ok(text)
        })
        .await
        .map_err(unavailable)?
    }
}
fn private_dir(path: &Path) -> Result<()> {
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
        Err(Error::Unavailable)
    }
}
