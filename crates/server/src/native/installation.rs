//! Private operator startup configuration. Never supplied by a browser request.
use serde::Deserialize;
use std::{collections::BTreeMap, io::Read, path::Path};
use zeroize::Zeroizing;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Configuration {
    schema: u32,
    environment: BTreeMap<String, Zeroizing<String>>,
}
const NAMES: &[&str] = &[
    "PG",
    "TENANT",
    "OBJECTS",
    "LISTEN",
    "PUBLIC_ORIGIN",
    "TLS_CERT",
    "TLS_KEY",
    "TLS_ROOT",
    "INSTANCE",
    "NETWORK_RESET",
    "FRONTENDS",
    "PRODUCTS",
    "ANIMATION",
    "AGENTS",
    "ATTACHMENTS",
    "WORKSPACES",
    "BACKUPS",
    "PG_DUMP",
    "BACKUP_DESTINATION",
    "PRESENTATION",
    "MAIL_SECRETS",
    "MAP_DOWNLOADS",
    "SETUP",
];
const NOT_PATHS: &[&str] = &[
    "PG",
    "TENANT",
    "LISTEN",
    "PUBLIC_ORIGIN",
    "INSTANCE",
    "NETWORK_RESET",
];
const INVALID: &str = "Invalid private native installation configuration.";

#[cfg(unix)]
pub fn load(path: &Path) -> Result<BTreeMap<String, Zeroizing<String>>, &'static str> {
    use rustix::fs::{Mode, OFlags, open};
    use std::os::unix::fs::MetadataExt;
    if !path.is_absolute() {
        return Err(INVALID);
    }
    let parent = path.parent().ok_or(INVALID)?;
    let private = |m: &std::fs::Metadata| {
        m.uid() == rustix::process::geteuid().as_raw() && m.mode() & 0o077 == 0
    };
    let directory = std::fs::metadata(parent).map_err(|_| INVALID)?;
    if !directory.is_dir() || !private(&directory) {
        return Err(INVALID);
    }
    let mut file = std::fs::File::from(
        open(
            path,
            OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::CLOEXEC | OFlags::NONBLOCK,
            Mode::empty(),
        )
        .map_err(|_| INVALID)?,
    );
    let meta = file.metadata().map_err(|_| INVALID)?;
    if !meta.is_file() || !private(&meta) || meta.len() > 65536 {
        return Err(INVALID);
    }
    let mut bytes = Zeroizing::new(Vec::new());
    file.by_ref()
        .take(65537)
        .read_to_end(&mut bytes)
        .map_err(|_| INVALID)?;
    if bytes.len() > 65536 {
        return Err(INVALID);
    }
    let config: Configuration = serde_json::from_slice(&bytes).map_err(|_| INVALID)?;
    let environment = config.environment;
    if config.schema != 1
        || !["PG", "TENANT", "OBJECTS"]
            .iter()
            .all(|name| environment.contains_key(&format!("AETHER_NATIVE_{name}")))
    {
        return Err(INVALID);
    }
    for (name, value) in environment.iter() {
        let suffix = name.strip_prefix("AETHER_NATIVE_").ok_or(INVALID)?;
        if !NAMES.contains(&suffix)
            || value.is_empty()
            || value.len() > 8192
            || value.chars().any(char::is_control)
            || (!NOT_PATHS.contains(&suffix) && !Path::new(value.as_str()).is_absolute())
        {
            return Err(INVALID);
        }
    }
    Ok(environment)
}
#[cfg(not(unix))]
pub fn load(_: &Path) -> Result<BTreeMap<String, Zeroizing<String>>, &'static str> {
    Err("Private installation files are currently qualified on Unix only.")
}

/// Re-exec before Tokio threads exist. No global environment mutation, no
/// inherited alternate native database, and no credential values in argv/logs.
pub fn execute(command: &str, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let environment = load(path)?;
    let mut process = std::process::Command::new(std::env::current_exe()?);
    process.arg(command).env_clear();
    for name in ["HOME", "TMPDIR", "PATH", "LANG", "LC_ALL"] {
        if let Some(value) = std::env::var_os(name) {
            process.env(name, value);
        }
    }
    process.envs(
        environment
            .iter()
            .map(|(name, value)| (name, value.as_str())),
    );
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        Err(process.exec().into())
    }
    #[cfg(not(unix))]
    Err("Installation execution is currently qualified on Unix only.".into())
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::{PermissionsExt, symlink};
    fn fixture() -> (tempfile::TempDir, std::path::PathBuf) {
        let root = tempfile::tempdir().unwrap();
        std::fs::set_permissions(root.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
        let path = root.path().join("installation.json");
        std::fs::write(&path, serde_json::to_vec(&serde_json::json!({"schema":1,"environment":{
            "AETHER_NATIVE_PG":"host=/private/socket user=private dbname=private password=never-log-me",
            "AETHER_NATIVE_TENANT":"company", "AETHER_NATIVE_OBJECTS":"/private/objects"
        }})).unwrap()).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
        (root, path)
    }
    #[test]
    fn private_configuration_refuses_permissions_symlinks_and_unknown_environment() {
        let (root, path) = fixture();
        assert_eq!(load(&path).unwrap().len(), 3);
        let link = root.path().join("link.json");
        symlink(&path, &link).unwrap();
        assert!(load(&link).is_err());
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        assert_eq!(load(&path).err(), Some(INVALID));
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
        std::fs::set_permissions(root.path(), std::fs::Permissions::from_mode(0o755)).unwrap();
        assert!(load(&path).is_err());
        std::fs::set_permissions(root.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
        let original = std::fs::read_to_string(&path).unwrap();
        for (key, value) in [
            ("LD_PRELOAD", "/evil"),
            ("AETHER_NATIVE_UNKNOWN", "unknown"),
            ("AETHER_NATIVE_FRONTENDS", "relative.json"),
            ("AETHER_NATIVE_LISTEN", "127.0.0.1:1\nsecret"),
        ] {
            let mut input: serde_json::Value = serde_json::from_str(&original).unwrap();
            input["environment"][key] = serde_json::json!(value);
            std::fs::write(&path, serde_json::to_vec(&input).unwrap()).unwrap();
            assert_eq!(load(&path).err(), Some(INVALID));
        }
    }
    #[test]
    fn malformed_configuration_is_bounded_and_never_echoes_secrets() {
        let (_root, path) = fixture();
        for data in [
            "password=never-log-me".to_owned(),
            "x".repeat(65537),
            r#"{"schema":2,"environment":{}}"#.into(),
        ] {
            std::fs::write(&path, data).unwrap();
            assert_eq!(load(&path).err(), Some(INVALID));
        }
        assert!(load(Path::new("relative.json")).is_err());
    }
}
