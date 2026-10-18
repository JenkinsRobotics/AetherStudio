use super::*;
fn mime(path: &str) -> Option<&'static str> {
    Some(match path.rsplit('.').next()? {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "wasm" => "application/wasm",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "onnx" | "task" | "bin" => "application/octet-stream",
        "txt" | "md" => "text/plain; charset=utf-8",
        _ if path.ends_with("/LICENSE") || path.ends_with("/NOTICE") => "text/plain; charset=utf-8",
        _ => return None,
    })
}
fn segment(name: &str) -> bool {
    !name.starts_with('.')
        && !name.is_empty()
        && name.len() <= 255
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_ .@()".contains(&b))
}
impl Snapshot {
    pub(super) fn insert(
        &mut self,
        path: String,
        bytes: Vec<u8>,
        mime: &'static str,
    ) -> Result<(), &'static str> {
        self.total = self.total.checked_add(bytes.len()).ok_or(INVALID)?;
        if bytes.len() > MAX_FILE || self.total > MAX_TOTAL || self.files.contains_key(&path) {
            return Err(INVALID);
        }
        self.files.insert(
            path,
            Asset {
                bytes: Bytes::from(bytes),
                mime,
            },
        );
        Ok(())
    }
    #[cfg(unix)]
    fn root(path: &Path) -> Result<std::fs::File, &'static str> {
        use rustix::fs::{Mode, OFlags, open};
        open(
            path,
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map(std::fs::File::from)
        .map_err(|_| INVALID)
    }
    #[cfg(unix)]
    fn read(dir: &std::fs::File, name: &str) -> Result<Vec<u8>, &'static str> {
        use rustix::fs::{Mode, OFlags, openat};
        let file = std::fs::File::from(
            openat(
                dir,
                name,
                OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::NONBLOCK | OFlags::CLOEXEC,
                Mode::empty(),
            )
            .map_err(|_| INVALID)?,
        );
        let meta = file.metadata().map_err(|_| INVALID)?;
        if !meta.is_file() || meta.len() > MAX_FILE as u64 {
            return Err(INVALID);
        }
        let mut bytes = Vec::new();
        file.take(MAX_FILE as u64 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| INVALID)?;
        if bytes.len() > MAX_FILE {
            return Err(INVALID);
        }
        Ok(bytes)
    }
    #[cfg(unix)]
    pub(super) fn session(&mut self, path: &Path) -> Result<(), &'static str> {
        let dir = Self::root(path)?;
        for (file, kind) in [
            ("account.js", "text/javascript; charset=utf-8"),
            ("account.css", "text/css; charset=utf-8"),
        ] {
            self.insert(format!("/suite/{file}"), Self::read(&dir, file)?, kind)?;
        }
        Ok(())
    }
    #[cfg(unix)]
    pub(super) fn tree(
        &mut self,
        path: &Path,
        prefix: &str,
        extension: Option<&str>,
    ) -> Result<(), &'static str> {
        self.walk(&Self::root(path)?, prefix, extension, 0)
    }
    #[cfg(unix)]
    fn walk(
        &mut self,
        dir: &std::fs::File,
        prefix: &str,
        extension: Option<&str>,
        depth: usize,
    ) -> Result<(), &'static str> {
        use rustix::fs::{Dir, FileType, Mode, OFlags, openat};
        if depth > 32 {
            return Err(INVALID);
        }
        for entry in Dir::read_from(dir).map_err(|_| INVALID)? {
            let entry = entry.map_err(|_| INVALID)?;
            let name = entry.file_name().to_str().map_err(|_| INVALID)?;
            if name == "." || name == ".." {
                continue;
            }
            self.entries += 1;
            if self.entries > MAX_ENTRIES {
                return Err(INVALID);
            }
            let kind = entry.file_type();
            if !matches!(kind, FileType::RegularFile | FileType::Directory) {
                return Err(INVALID);
            }
            if !segment(name) {
                continue;
            }
            let route = format!("{prefix}/{name}");
            if route.len() > 4096 {
                return Err(INVALID);
            }
            if kind == FileType::Directory {
                let child = std::fs::File::from(
                    openat(
                        dir,
                        name,
                        OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                        Mode::empty(),
                    )
                    .map_err(|_| INVALID)?,
                );
                self.walk(&child, &route, extension, depth + 1)?;
            } else if extension.is_none_or(|e| name.ends_with(&format!(".{e}")))
                && let Some(kind) = mime(&route)
            {
                self.insert(route, Self::read(dir, name)?, kind)?;
            }
        }
        Ok(())
    }
    #[cfg(not(unix))]
    pub(super) fn session(&mut self, _: &Path) -> Result<(), &'static str> {
        Err("Native frontend snapshot loading is currently qualified on Unix only.")
    }
    #[cfg(not(unix))]
    pub(super) fn tree(&mut self, _: &Path, _: &str, _: Option<&str>) -> Result<(), &'static str> {
        Err("Native frontend snapshot loading is currently qualified on Unix only.")
    }
}
