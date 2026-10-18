//! Account-free, ordinary document file IO for desktop/CLI adapters.
//! No database, revision history, network, UI, or product-format interpretation.
use aether_protocol_core::local_files::*;
use base64::{Engine, engine::general_purpose::STANDARD};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
};

pub const MAX_DOCUMENT_BYTES: usize = 64 * 1024 * 1024;
const MAX_RECOVERY_BYTES: usize = MAX_DOCUMENT_BYTES.div_ceil(3) * 4 + 16 * 1024;

#[derive(Debug, thiserror::Error)]
#[error("{code:?}: {message}")]
pub struct LocalFileError {
    pub code: LocalFileErrorCode,
    pub message: String,
}
pub type Result<T> = std::result::Result<T, LocalFileError>;
fn error(code: LocalFileErrorCode, message: &str) -> LocalFileError {
    LocalFileError {
        code,
        message: message.into(),
    }
}
fn io(_: std::io::Error) -> LocalFileError {
    error(
        LocalFileErrorCode::IoFailure,
        "Local file operation failed; the current file has not been confirmed saved.",
    )
}
fn fingerprint(bytes: &[u8]) -> FileFingerprint {
    FileFingerprint {
        sha256: format!("{:x}", Sha256::digest(bytes)),
        size_bytes: bytes.len() as u64,
    }
}
fn valid_hash(hash: &str) -> bool {
    hash.len() == 64
        && hash
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
fn validate_expected(expected: &FileExpectation) -> Result<()> {
    if let FileExpectation::Content { sha256 } = expected
        && !valid_hash(sha256)
    {
        return Err(error(
            LocalFileErrorCode::InvalidRequest,
            "Use the fingerprint returned when the file was read.",
        ));
    }
    Ok(())
}
fn regular(path: &Path) -> Result<Option<fs::Metadata>> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
            Ok(Some(metadata))
        }
        Ok(_) => Err(error(
            LocalFileErrorCode::InvalidPath,
            "Select a regular file, not a symbolic link or directory.",
        )),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(io(e)),
    }
}
fn bytes_at(path: &Path, limit: usize) -> Result<Option<Vec<u8>>> {
    let Some(metadata) = regular(path)? else {
        return Ok(None);
    };
    if metadata.len() > limit as u64 {
        return Err(error(
            LocalFileErrorCode::TooLarge,
            "Document exceeds this adapter's size limit.",
        ));
    }
    let mut bytes = Vec::new();
    File::open(path)
        .map_err(io)?
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(io)?;
    if bytes.len() > limit {
        return Err(error(
            LocalFileErrorCode::TooLarge,
            "Document exceeds this adapter's size limit.",
        ));
    }
    Ok(Some(bytes))
}
fn expectation(path: &Path) -> Result<FileExpectation> {
    Ok(match bytes_at(path, MAX_DOCUMENT_BYTES)? {
        None => FileExpectation::Missing,
        Some(bytes) => FileExpectation::Content {
            sha256: fingerprint(&bytes).sha256,
        },
    })
}
fn require_expected(path: &Path, expected: &FileExpectation) -> Result<()> {
    if &expectation(path)? != expected {
        return Err(error(
            LocalFileErrorCode::Conflict,
            "The file changed outside this editor. Keep the draft and resolve the newer file before saving.",
        ));
    }
    Ok(())
}
fn private_directory(path: &Path) -> Result<()> {
    if path.exists() {
        if fs::symlink_metadata(path)
            .map_err(io)?
            .file_type()
            .is_symlink()
            || !path.is_dir()
        {
            return Err(error(
                LocalFileErrorCode::InvalidPath,
                "Recovery storage must be a directory, not a link.",
            ));
        }
        return Ok(());
    }
    let mut builder = fs::DirBuilder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    match builder.create(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => private_directory(path),
        Err(e) => Err(io(e)),
    }
}
fn sync_directory(path: &Path) -> Result<FileDurability> {
    #[cfg(unix)]
    {
        File::open(path).and_then(|file| file.sync_all()).map_err(|_| error(LocalFileErrorCode::OutcomeUnknown, "The new file was published but directory synchronization failed. Reopen it before retrying."))?;
        Ok(FileDurability::FileAndDirectory)
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Ok(FileDurability::FileOnly)
    }
}
fn prepare(
    parent: &Path,
    content: &[u8],
    permissions: Option<fs::Permissions>,
) -> Result<tempfile::NamedTempFile> {
    let mut staged = tempfile::Builder::new()
        .prefix(".aether-save-")
        .tempfile_in(parent)
        .map_err(io)?;
    if let Some(permissions) = permissions {
        staged.as_file().set_permissions(permissions).map_err(io)?;
    }
    staged.write_all(content).map_err(io)?;
    staged.as_file().sync_all().map_err(io)?;
    Ok(staged)
}

/// Paths come from an explicit local file picker/CLI, never an untrusted remote
/// request. All Aether processes on a workstation must share the recovery root.
/// OS locks coordinate Aether writers; unrelated editors may ignore these locks.
struct WriterLock(File);
impl Drop for WriterLock {
    fn drop(&mut self) {
        // Closing one descriptor may not release flock while a forked child
        // still holds the same open file description, even before exec closes
        // close-on-exec handles. Explicit unlock ends this operation's lease.
        let _ = self.0.unlock();
    }
}

pub struct LocalDocument {
    path: PathBuf,
    recovery_directory: PathBuf,
}
impl LocalDocument {
    pub fn new(path: impl AsRef<Path>, recovery_root: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        if !path.is_absolute() || path.file_name().is_none() || path.to_str().is_none() {
            return Err(error(
                LocalFileErrorCode::InvalidPath,
                "Choose an absolute UTF-8 document path.",
            ));
        }
        let parent = path
            .parent()
            .ok_or_else(|| error(LocalFileErrorCode::InvalidPath, "Choose a file path."))?
            .canonicalize()
            .map_err(io)?;
        let path = parent.join(path.file_name().unwrap());
        if path.to_str().is_none() || path.as_os_str().len() > 8192 {
            return Err(error(
                LocalFileErrorCode::InvalidPath,
                "Canonical document path must be UTF-8 and within the adapter limit.",
            ));
        }
        regular(&path)?;
        let root = recovery_root.as_ref();
        if !root.is_absolute() {
            return Err(error(
                LocalFileErrorCode::InvalidPath,
                "Choose an absolute application recovery directory.",
            ));
        }
        private_directory(root)?;
        let root = root.canonicalize().map_err(io)?;
        let namespace = root.join("aether-file-recovery-v1");
        private_directory(&namespace)?;
        let directory = namespace.join(format!(
            "{:x}",
            Sha256::digest(path.as_os_str().as_encoded_bytes())
        ));
        private_directory(&directory)?;
        // Persist newly-created recovery directories before acknowledging a draft.
        sync_directory(&namespace)?;
        sync_directory(&root)?;
        if let Some(parent) = root.parent() {
            sync_directory(parent)?;
        }
        Ok(Self {
            path,
            recovery_directory: directory,
        })
    }
    pub fn path(&self) -> &Path {
        &self.path
    }
    fn lock(&self) -> Result<WriterLock> {
        let path = self.recovery_directory.join("writer.lock");
        regular(&path)?;
        let mut options = OpenOptions::new();
        options.read(true).write(true).create(true).truncate(false);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let lock = options.open(path).map_err(io)?;
        lock.try_lock().map_err(|e| match e {
            std::fs::TryLockError::WouldBlock => error(
                LocalFileErrorCode::Busy,
                "Another Aether process is saving or recovering this file.",
            ),
            std::fs::TryLockError::Error(e) => io(e),
        })?;
        Ok(WriterLock(lock)) // Stable inode; explicit unlock on drop, OS release on process exit.
    }
    pub fn read(&self) -> Result<(Vec<u8>, FileFingerprint)> {
        let _lock = self.lock()?;
        let bytes = bytes_at(&self.path, MAX_DOCUMENT_BYTES)?
            .ok_or_else(|| error(LocalFileErrorCode::NotFound, "Document does not exist."))?;
        let signature = fingerprint(&bytes);
        Ok((bytes, signature))
    }
    pub fn save(&self, expected: &FileExpectation, content: &[u8]) -> Result<LocalSaveReceipt> {
        self.save_inner(expected, content, || {})
    }
    fn save_inner(
        &self,
        expected: &FileExpectation,
        content: &[u8],
        before_publish: impl FnOnce(),
    ) -> Result<LocalSaveReceipt> {
        validate_expected(expected)?;
        if content.len() > MAX_DOCUMENT_BYTES {
            return Err(error(
                LocalFileErrorCode::TooLarge,
                "Document exceeds this adapter's size limit.",
            ));
        }
        let _lock = self.lock()?;
        require_expected(&self.path, expected)?;
        let metadata = regular(&self.path)?;
        if metadata
            .as_ref()
            .is_some_and(|m| m.permissions().readonly())
        {
            return Err(error(
                LocalFileErrorCode::IoFailure,
                "The selected file is read-only.",
            ));
        }
        let parent = self.path.parent().unwrap();
        let staged = prepare(parent, content, metadata.map(|m| m.permissions()))?;
        before_publish();
        // Detect external edits made during staging as well as since initial read.
        require_expected(&self.path, expected)?;
        match expected {
            FileExpectation::Missing => {
                staged.persist_noclobber(&self.path).map_err(|e| {
                    if e.error.kind() == std::io::ErrorKind::AlreadyExists {
                        error(
                            LocalFileErrorCode::Conflict,
                            "A file was created at this path; it was not overwritten.",
                        )
                    } else {
                        io(e.error)
                    }
                })?;
            }
            FileExpectation::Content { .. } => {
                staged.persist(&self.path).map_err(|e| io(e.error))?;
            }
        }
        let durability = sync_directory(parent)?;
        Ok(LocalSaveReceipt {
            file: fingerprint(content),
            durability,
        })
    }
    fn draft_path(&self, session: &str) -> Result<PathBuf> {
        if session.is_empty()
            || session.len() > 128
            || !session
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"-_".contains(&c))
        {
            return Err(error(
                LocalFileErrorCode::InvalidRequest,
                "Use a distinct recovery session ID of ASCII letters, digits, dash or underscore.",
            ));
        }
        Ok(self.recovery_directory.join(format!("{session}.json")))
    }
    /// One latest recovery draft per editor session, not a revision history.
    /// Staging remains possible after an outside edit; reading reports the conflict.
    pub fn stage_recovery(
        &self,
        session: &str,
        base: FileExpectation,
        content: &[u8],
    ) -> Result<LocalSaveReceipt> {
        validate_expected(&base)?;
        if content.len() > MAX_DOCUMENT_BYTES {
            return Err(error(
                LocalFileErrorCode::TooLarge,
                "Recovery draft exceeds the size limit.",
            ));
        }
        let destination = self.draft_path(session)?;
        let _lock = self.lock()?;
        regular(&destination)?;
        let draft = RecoveryDraft {
            format_version: 1,
            document_path: self.path.to_str().unwrap().into(),
            session_id: session.into(),
            base,
            content: fingerprint(content),
            content_base64: STANDARD.encode(content),
        };
        let bytes = serde_json::to_vec(&draft).map_err(|_| {
            error(
                LocalFileErrorCode::InvalidRequest,
                "Could not encode recovery draft.",
            )
        })?;
        prepare(&self.recovery_directory, &bytes, None)?
            .persist(destination)
            .map_err(|e| io(e.error))?;
        let durability = sync_directory(&self.recovery_directory)?;
        Ok(LocalSaveReceipt {
            file: draft.content,
            durability,
        })
    }
    fn read_draft(&self, session: &str) -> Result<Option<RecoveryDraft>> {
        let Some(bytes) = bytes_at(&self.draft_path(session)?, MAX_RECOVERY_BYTES)? else {
            return Ok(None);
        };
        let bad = || {
            error(
                LocalFileErrorCode::CorruptRecovery,
                "Recovery draft failed validation; it was retained for inspection.",
            )
        };
        let draft: RecoveryDraft = serde_json::from_slice(&bytes).map_err(|_| bad())?;
        if draft.format_version != 1
            || draft.document_path != self.path.to_str().unwrap()
            || draft.session_id != session
            || validate_expected(&draft.base).is_err()
        {
            return Err(bad());
        }
        let content = STANDARD.decode(&draft.content_base64).map_err(|_| bad())?;
        if content.len() > MAX_DOCUMENT_BYTES || fingerprint(&content) != draft.content {
            return Err(bad());
        }
        Ok(Some(draft))
    }
    pub fn recovery(&self, session: &str) -> Result<Option<RecoveryCandidate>> {
        let _lock = self.lock()?;
        self.read_draft(session)?
            .map(|draft| {
                let current = expectation(&self.path)?;
                let base_matches_current_file = current == draft.base;
                let content_matches_current_file = current
                    == FileExpectation::Content {
                        sha256: draft.content.sha256.clone(),
                    };
                Ok(RecoveryCandidate {
                    draft,
                    base_matches_current_file,
                    content_matches_current_file,
                })
            })
            .transpose()
    }
    /// Bounded discovery after a crash; does not require remembering a session ID.
    pub fn list_recovery(&self) -> Result<RecoveryListing> {
        let _lock = self.lock()?;
        let mut sessions = Vec::new();
        for entry in fs::read_dir(&self.recovery_directory).map_err(io)? {
            let entry = entry.map_err(io)?;
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "json") {
                let session = path.file_stem().and_then(|s| s.to_str()).ok_or_else(|| {
                    error(
                        LocalFileErrorCode::CorruptRecovery,
                        "Invalid recovery filename; retained for inspection.",
                    )
                })?;
                self.draft_path(session)?;
                sessions.push(session.to_owned());
                if sessions.len() > 128 {
                    return Err(error(
                        LocalFileErrorCode::TooLarge,
                        "More than 128 recovery sessions remain for this document; retain them and resolve older drafts explicitly.",
                    ));
                }
            }
        }
        sessions.sort();
        let current = expectation(&self.path)?;
        let mut listing = RecoveryListing {
            drafts: Vec::new(),
            corrupt_sessions: Vec::new(),
        };
        for session in sessions {
            match self.read_draft(&session) {
                Ok(Some(draft)) => listing.drafts.push(RecoverySummary {
                    session_id: session,
                    base_matches_current_file: current == draft.base,
                    content_matches_current_file: current
                        == FileExpectation::Content {
                            sha256: draft.content.sha256.clone(),
                        },
                    content: draft.content,
                }),
                Ok(None) => {}
                Err(e)
                    if matches!(
                        e.code,
                        LocalFileErrorCode::CorruptRecovery
                            | LocalFileErrorCode::InvalidPath
                            | LocalFileErrorCode::TooLarge
                    ) =>
                {
                    listing.corrupt_sessions.push(session)
                }
                Err(e) => return Err(e),
            }
        }
        Ok(listing)
    }
    pub fn discard_recovery(
        &self,
        session: &str,
        expected_content: &FileFingerprint,
    ) -> Result<()> {
        let _lock = self.lock()?;
        let draft = self.read_draft(session)?.ok_or_else(|| {
            error(
                LocalFileErrorCode::NotFound,
                "Recovery draft does not exist.",
            )
        })?;
        if &draft.content != expected_content {
            return Err(error(
                LocalFileErrorCode::Conflict,
                "The recovery draft changed; it was not discarded.",
            ));
        }
        fs::remove_file(self.draft_path(session)?).map_err(io)?;
        sync_directory(&self.recovery_directory)?;
        Ok(())
    }
}

/// Shared local adapter used by the CLI and future Tauri file-picker integration.
pub fn execute(request: LocalFileRequest) -> Result<LocalFileResult> {
    let document = LocalDocument::new(&request.document_path, &request.recovery_root)?;
    let decode = |encoded: &str| -> Result<Vec<u8>> {
        if encoded.len() > MAX_DOCUMENT_BYTES.div_ceil(3) * 4 {
            return Err(error(
                LocalFileErrorCode::TooLarge,
                "Document exceeds the size limit.",
            ));
        }
        STANDARD.decode(encoded).map_err(|_| {
            error(
                LocalFileErrorCode::InvalidRequest,
                "Invalid document base64.",
            )
        })
    };
    Ok(match request.operation {
        LocalFileOperation::ListRecovery => LocalFileResult::ListRecovery {
            listing: document.list_recovery()?,
        },
        LocalFileOperation::Read => {
            let (bytes, file) = document.read()?;
            LocalFileResult::Read {
                file,
                content_base64: STANDARD.encode(bytes),
            }
        }
        LocalFileOperation::Save {
            expected,
            content_base64,
        } => LocalFileResult::Save {
            receipt: document.save(&expected, &decode(&content_base64)?)?,
        },
        LocalFileOperation::StageRecovery {
            session_id,
            base,
            content_base64,
        } => LocalFileResult::StageRecovery {
            receipt: document.stage_recovery(&session_id, base, &decode(&content_base64)?)?,
        },
        LocalFileOperation::ReadRecovery { session_id } => LocalFileResult::ReadRecovery {
            candidate: document.recovery(&session_id)?,
        },
        LocalFileOperation::DiscardRecovery {
            session_id,
            expected_content,
        } => {
            document.discard_recovery(&session_id, &expected_content)?;
            LocalFileResult::DiscardRecovery
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (tempfile::TempDir, LocalDocument) {
        let root = tempfile::tempdir().unwrap();
        let document = LocalDocument::new(
            root.path().join("part.aethercad"),
            root.path().join("recovery"),
        )
        .unwrap();
        (root, document)
    }
    fn current(document: &LocalDocument) -> FileExpectation {
        FileExpectation::Content {
            sha256: document.read().unwrap().1.sha256,
        }
    }
    #[test]
    fn ordinary_file_bytes_guard_edits_and_preserve_other_work() {
        let (_root, document) = fixture();
        document
            .save(&FileExpectation::Missing, b"original\0bytes")
            .unwrap();
        let initial = current(&document);
        document.save(&initial, b"next").unwrap();
        assert_eq!(
            document.save(&initial, b"stale").unwrap_err().code,
            LocalFileErrorCode::Conflict
        );
        assert_eq!(fs::read(document.path()).unwrap(), b"next");
        assert_eq!(
            document
                .save(&FileExpectation::Missing, b"overwrite")
                .unwrap_err()
                .code,
            LocalFileErrorCode::Conflict
        );
        assert_eq!(fs::read(document.path()).unwrap(), b"next");
    }
    #[test]
    fn outside_edit_during_staging_is_not_overwritten() {
        let (_root, document) = fixture();
        document
            .save(&FileExpectation::Missing, b"initial")
            .unwrap();
        let expected = current(&document);
        let result = document.save_inner(&expected, b"mine", || {
            fs::write(document.path(), b"external").unwrap()
        });
        assert_eq!(result.unwrap_err().code, LocalFileErrorCode::Conflict);
        assert_eq!(fs::read(document.path()).unwrap(), b"external");
    }
    #[test]
    fn separate_recovery_sessions_preserve_drafts_and_report_conflicts() {
        let (_root, document) = fixture();
        document
            .save(&FileExpectation::Missing, b"initial")
            .unwrap();
        let expected = current(&document);
        let first = document
            .stage_recovery("window-1", expected.clone(), b"my draft")
            .unwrap();
        document
            .stage_recovery("window-2", expected.clone(), b"other draft")
            .unwrap();
        assert!(
            document
                .recovery("window-1")
                .unwrap()
                .unwrap()
                .base_matches_current_file
        );
        document.save(&expected, b"newer file").unwrap();
        let candidate = document.recovery("window-1").unwrap().unwrap();
        assert!(!candidate.base_matches_current_file);
        assert_eq!(fs::read(document.path()).unwrap(), b"newer file");
        assert_eq!(
            STANDARD.decode(candidate.draft.content_base64).unwrap(),
            b"my draft"
        );
        document.discard_recovery("window-1", &first.file).unwrap();
        assert!(document.recovery("window-1").unwrap().is_none());
        assert!(document.recovery("window-2").unwrap().is_some());
    }
    #[test]
    fn corrupt_recovery_and_stale_discard_keep_evidence() {
        let (_root, document) = fixture();
        let first = document
            .stage_recovery("session", FileExpectation::Missing, b"one")
            .unwrap();
        document
            .stage_recovery("session", FileExpectation::Missing, b"two")
            .unwrap();
        assert_eq!(
            document
                .discard_recovery("session", &first.file)
                .unwrap_err()
                .code,
            LocalFileErrorCode::Conflict
        );
        let path = document.draft_path("session").unwrap();
        let mut draft: ValueForTest = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        draft["content_base64"] = serde_json::json!(STANDARD.encode(b"tampered"));
        fs::write(&path, serde_json::to_vec(&draft).unwrap()).unwrap();
        assert_eq!(
            document.recovery("session").unwrap_err().code,
            LocalFileErrorCode::CorruptRecovery
        );
        assert!(path.exists());
        assert!(!document.path().exists());
    }
    type ValueForTest = serde_json::Value;
    #[test]
    fn sparse_oversize_and_unsafe_paths_are_refused() {
        let (_root, document) = fixture();
        File::create(document.path())
            .unwrap()
            .set_len(MAX_DOCUMENT_BYTES as u64 + 1)
            .unwrap();
        assert_eq!(
            document.read().unwrap_err().code,
            LocalFileErrorCode::TooLarge
        );
        assert!(
            document
                .stage_recovery("../escape", FileExpectation::Missing, b"bad")
                .is_err()
        );
        assert!(LocalDocument::new("relative.file", document.recovery_directory.clone()).is_err());
    }
    #[cfg(unix)]
    #[test]
    fn symbolic_links_and_readonly_files_are_not_replaced() {
        use std::os::unix::fs::{PermissionsExt, symlink};
        let (root, document) = fixture();
        let external = root.path().join("external");
        fs::write(&external, b"precious").unwrap();
        symlink(&external, document.path()).unwrap();
        assert_eq!(
            document
                .save(&FileExpectation::Missing, b"bad")
                .unwrap_err()
                .code,
            LocalFileErrorCode::InvalidPath
        );
        assert_eq!(fs::read(external).unwrap(), b"precious");
        fs::remove_file(document.path()).unwrap();
        document
            .save(&FileExpectation::Missing, b"original")
            .unwrap();
        fs::set_permissions(document.path(), fs::Permissions::from_mode(0o444)).unwrap();
        assert_eq!(
            document.save(&current(&document), b"bad").unwrap_err().code,
            LocalFileErrorCode::IoFailure
        );
        assert_eq!(fs::read(document.path()).unwrap(), b"original");
    }
    #[test]
    fn crashed_writer_releases_lock_and_retains_old_file_and_recovery() {
        let (root, document) = fixture();
        document.save(&FileExpectation::Missing, b"old").unwrap();
        document
            .stage_recovery("crashed", current(&document), b"unsaved")
            .unwrap();
        let child = std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "tests::crash_worker", "--nocapture"])
            .env("AETHER_FILE_CRASH_ROOT", root.path())
            .status()
            .unwrap();
        assert_eq!(child.code(), Some(77));
        assert_eq!(document.read().unwrap().0, b"old");
        assert_eq!(
            STANDARD
                .decode(
                    document
                        .recovery("crashed")
                        .unwrap()
                        .unwrap()
                        .draft
                        .content_base64
                )
                .unwrap(),
            b"unsaved"
        );
        document.save(&current(&document), b"resumed").unwrap();
    }
    #[test]
    fn crash_worker() {
        let Some(root) = std::env::var_os("AETHER_FILE_CRASH_ROOT") else {
            return;
        };
        let root = PathBuf::from(root);
        let document =
            LocalDocument::new(root.join("part.aethercad"), root.join("recovery")).unwrap();
        if std::env::var_os("AETHER_FILE_CRASH_AFTER").is_some() {
            document.save(&current(&document), b"unsaved").unwrap();
            std::process::exit(78);
        }
        document
            .save_inner(&current(&document), b"not published", || {
                std::process::exit(77)
            })
            .unwrap();
        panic!("Crash hook did not exit");
    }
    #[test]
    fn inherited_file_description_does_not_extend_completed_operation_lock() {
        let (_root, document) = fixture();
        let guard = document.lock().unwrap();
        // A fork inherits this same open file description. Keep a duplicate
        // alive to deterministically model a child not yet reaching exec/exit.
        let inherited = guard.0.try_clone().unwrap();
        assert!(matches!(document.lock(), Err(e) if e.code == LocalFileErrorCode::Busy));
        drop(guard);
        document
            .save(&FileExpectation::Missing, b"completed")
            .unwrap();
        assert_eq!(document.read().unwrap().0, b"completed");
        drop(inherited);
    }
    #[test]
    fn competing_writers_use_os_lock_and_stale_guard() {
        let (_root, document) = fixture();
        document.save(&FileExpectation::Missing, b"start").unwrap();
        let lock = document.lock().unwrap();
        assert_eq!(
            document
                .save(&FileExpectation::Missing, b"bad")
                .unwrap_err()
                .code,
            LocalFileErrorCode::Busy
        );
        drop(lock);
        let expected = current(&document);
        std::thread::scope(|scope| {
            let a = scope.spawn(|| document.save(&expected, b"a"));
            let b = scope.spawn(|| document.save(&expected, b"b"));
            let a = a.join().unwrap();
            let b = b.join().unwrap();
            assert_eq!(usize::from(a.is_ok()) + usize::from(b.is_ok()), 1);
            let failure = a.err().or(b.err()).unwrap();
            assert!(matches!(
                failure.code,
                LocalFileErrorCode::Busy | LocalFileErrorCode::Conflict
            ));
        });
    }
    #[test]
    fn saved_file_and_recovery_are_discoverable_after_response_loss() {
        let (root, document) = fixture();
        document.save(&FileExpectation::Missing, b"old").unwrap();
        document
            .stage_recovery("crashed", current(&document), b"unsaved")
            .unwrap();
        let child = std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "tests::crash_worker", "--nocapture"])
            .env("AETHER_FILE_CRASH_ROOT", root.path())
            .env("AETHER_FILE_CRASH_AFTER", "1")
            .status()
            .unwrap();
        assert_eq!(child.code(), Some(78));
        assert_eq!(document.read().unwrap().0, b"unsaved");
        let listing = document.list_recovery().unwrap();
        assert_eq!(listing.drafts.len(), 1);
        assert!(listing.drafts[0].content_matches_current_file);
        assert!(!listing.drafts[0].base_matches_current_file);
        assert_eq!(listing.drafts[0].session_id, "crashed");
    }
    #[test]
    fn discovery_reports_corrupt_drafts_alongside_valid_sessions() {
        let (_root, document) = fixture();
        document
            .stage_recovery("valid", FileExpectation::Missing, b"draft")
            .unwrap();
        fs::write(document.draft_path("broken").unwrap(), b"not json").unwrap();
        let listing = document.list_recovery().unwrap();
        assert_eq!(listing.drafts.len(), 1);
        assert_eq!(listing.corrupt_sessions, vec!["broken"]);
        assert!(!document.path().exists());
    }
}
