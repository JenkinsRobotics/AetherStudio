//! Trusted operator-installed product bundles. No executable/path comes from a client.
use crate::documents::{Error, Result};
use aether_protocol_core::CommandDescriptor;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashSet},
    path::{Path, PathBuf},
    process::Stdio,
    sync::Arc,
    time::Duration,
};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    sync::Semaphore,
};

pub const MAX_CONTENT: usize = 4 * 1024 * 1024;
pub(crate) const MAX_INPUT: usize = 16 * 1024 * 1024;
const MAX_OUTPUT: usize = 8 * 1024 * 1024;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Configuration {
    schema: u32,
    node: PathBuf,
    python: Option<PathBuf>,
    freecad: Option<PathBuf>,
    manifests: Vec<PathBuf>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    schema: u32,
    app: String,
    entry: String,
    sha256: String,
    commands: Vec<CommandDescriptor>,
    #[serde(default)]
    binary_commands: Vec<String>,
    #[serde(default)]
    services: Vec<String>,
    #[serde(default)]
    runtime: Runtime,
}
#[derive(Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Runtime {
    #[default]
    Node,
    Python,
}
#[derive(Clone)]
pub struct Product {
    pub app: String,
    pub descriptor: CommandDescriptor,
    entry: PathBuf,
    runtime: Runtime,
    binary: bool,
}
impl Product {
    fn encode_content(&self, bytes: &[u8]) -> Result<String> {
        if bytes.len() > MAX_CONTENT {
            return Err(Error::TooLarge);
        }
        if self.binary {
            Ok(STANDARD.encode(bytes))
        } else {
            String::from_utf8(bytes.to_vec()).map_err(|_| Error::Invalid)
        }
    }
    pub(crate) fn decode_content(&self, content: &str) -> Result<Vec<u8>> {
        let bytes = if self.binary {
            if content.len() > MAX_CONTENT.div_ceil(3) * 4 {
                return Err(Error::TooLarge);
            }
            STANDARD.decode(content).map_err(|_| Error::Invalid)?
        } else {
            content.as_bytes().to_vec()
        };
        if bytes.len() > MAX_CONTENT {
            return Err(Error::TooLarge);
        }
        Ok(bytes)
    }
}
#[derive(Clone)]
struct Service {
    entry: PathBuf,
    runtime: Runtime,
}
struct Inner {
    node: PathBuf,
    python: Option<PathBuf>,
    freecad: Option<PathBuf>,
    commands: BTreeMap<String, Product>,
    services: BTreeMap<String, Service>,
    slots: Semaphore,
    pending: Semaphore,
    _bundle: tempfile::TempDir,
}
#[derive(Clone)]
pub struct Products(Arc<Inner>);
fn read(path: &Path, max: usize) -> Result<Vec<u8>> {
    use std::io::Read;
    let mut bytes = Vec::new();
    std::fs::File::open(path)
        .map_err(|_| Error::Unavailable)?
        .take(max as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| Error::Unavailable)?;
    if bytes.len() > max {
        return Err(Error::TooLarge);
    }
    Ok(bytes)
}
impl Products {
    pub fn load(path: &Path) -> Result<Self> {
        let config: Configuration =
            serde_json::from_slice(&read(path, 65536)?).map_err(|_| Error::Invalid)?;
        if config.schema != 1
            || !config.node.is_absolute()
            || !config.node.is_file()
            || config.manifests.is_empty()
            || config.manifests.len() > 16
        {
            return Err(Error::Invalid);
        }
        let bundle = tempfile::tempdir().map_err(|_| Error::Unavailable)?;
        let mut commands = BTreeMap::new();
        let mut apps = HashSet::new();
        let mut services = BTreeMap::new();
        for path in &config.manifests {
            if !path.is_absolute() {
                return Err(Error::Invalid);
            }
            let manifest: Manifest =
                serde_json::from_slice(&read(path, 1024 * 1024)?).map_err(|_| Error::Invalid)?;
            if manifest.schema != 1
                || !crate::documents::automation::APPS.contains(&manifest.app.as_str())
                || !apps.insert(manifest.app.clone())
                || manifest.entry
                    != match manifest.runtime {
                        Runtime::Node => "runner.mjs",
                        Runtime::Python => "runner.pyz",
                    }
                || manifest.commands.is_empty()
                || manifest.commands.len() > 128
                || manifest.services.len() > 32
            {
                return Err(Error::Invalid);
            }
            let binary: HashSet<_> = manifest.binary_commands.iter().collect();
            if binary.len() != manifest.binary_commands.len()
                || binary
                    .iter()
                    .any(|id| !manifest.commands.iter().any(|c| &c.id == *id))
            {
                return Err(Error::Invalid);
            }
            if matches!(manifest.runtime, Runtime::Python)
                && [&config.python, &config.freecad]
                    .iter()
                    .any(|p| !p.as_ref().is_some_and(|p| p.is_absolute() && p.is_file()))
            {
                return Err(Error::Invalid);
            }
            let bytes = read(
                &path.parent().ok_or(Error::Invalid)?.join(&manifest.entry),
                8 * 1024 * 1024,
            )?;
            if format!("{:x}", Sha256::digest(&bytes)) != manifest.sha256 {
                return Err(Error::Incompatible);
            }
            // Snapshot the verified single-file bundle into private operator state.
            let entry = bundle
                .path()
                .join(format!("{}-{}", manifest.app, manifest.entry));
            std::fs::write(&entry, bytes).map_err(|_| Error::Unavailable)?;
            for path in manifest.services {
                let suffix = path.strip_prefix(&format!("/api/{}/", manifest.app));
                if !suffix.is_some_and(|s| {
                    !s.is_empty()
                        && s.len() <= 64
                        && s.bytes()
                            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
                }) || services
                    .insert(
                        path,
                        Service {
                            entry: entry.clone(),
                            runtime: manifest.runtime,
                        },
                    )
                    .is_some()
                {
                    return Err(Error::Invalid);
                }
            }
            for descriptor in manifest.commands {
                let required = descriptor.input_schema["required"]
                    .as_array()
                    .ok_or(Error::Invalid)?;
                if !descriptor.id.starts_with(&format!("{}.", manifest.app))
                    || descriptor.id.len() > 128
                    || descriptor.id.split('.').any(|s| {
                        s.is_empty()
                            || !s
                                .bytes()
                                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
                    })
                    || descriptor.title.is_empty()
                    || descriptor.title.len() > 200
                    || descriptor.description.len() > 4000
                    || descriptor.annotations["readOnlyHint"] != !descriptor.writes
                    || descriptor.annotations["openWorldHint"] != false
                    || !required.contains(&json!("app"))
                    || !required.contains(&json!("id"))
                    || descriptor.input_schema["properties"]["app"]["enum"] != json!([manifest.app])
                    || descriptor.writes
                        && (!required.contains(&json!("expected_revision"))
                            || descriptor.input_schema["properties"]["expected_revision"]["type"]
                                != "integer")
                {
                    return Err(Error::Invalid);
                }
                validate_schema(&descriptor.input_schema)?;
                let product = Product {
                    app: manifest.app.clone(),
                    binary: binary.contains(&descriptor.id),
                    descriptor,
                    entry: entry.clone(),
                    runtime: manifest.runtime,
                };
                if commands
                    .insert(product.descriptor.id.clone(), product)
                    .is_some()
                {
                    return Err(Error::Invalid);
                }
            }
        }
        Ok(Self(Arc::new(Inner {
            node: config.node,
            python: config.python,
            freecad: config.freecad,
            commands,
            services,
            slots: Semaphore::new(2),
            pending: Semaphore::new(8),
            _bundle: bundle,
        })))
    }
    pub fn commands(&self) -> impl Iterator<Item = &Product> {
        self.0.commands.values()
    }
    pub fn get(&self, id: &str) -> Option<Product> {
        self.0.commands.get(id).cloned()
    }
    /// Installed browser services, not a health probe or feature-parity claim.
    pub(crate) fn cad_browser_configured(&self) -> bool {
        self.0.python.as_ref().is_some_and(|p| p.is_file())
            && self.0.freecad.as_ref().is_some_and(|p| p.is_file())
            && [
                "geometry",
                "export",
                "analysis",
                "assembly",
                "mate-kinds",
                "engine",
            ]
            .iter()
            .all(|action| self.0.services.contains_key(&format!("/api/cad/{action}")))
    }
    pub async fn execute(
        &self,
        product: &Product,
        content: &str,
        arguments: &Value,
    ) -> Result<Value> {
        self.execute_bytes(product, content.as_bytes(), arguments)
            .await
    }
    /// Binary transport is selected only by the trusted installed manifest.
    pub async fn execute_bytes(
        &self,
        product: &Product,
        content: &[u8],
        arguments: &Value,
    ) -> Result<Value> {
        let encoded = product.encode_content(content)?;
        validate_arguments(arguments, &product.descriptor.input_schema)?;
        let mut request =
            json!({"command":product.descriptor.id,"content":encoded,"arguments":arguments});
        if product.binary {
            request["content_encoding"] = json!("base64");
        }
        let result = self
            .invoke(
                &product.entry,
                product.runtime,
                product.descriptor.writes,
                &request,
            )
            .await?;
        if let Some(content) = result.get("content").and_then(Value::as_str) {
            product.decode_content(content)?;
        }
        Ok(result)
    }
    /// Stateless browser computations only: no document lookup, credentials or writes.
    pub async fn service(&self, path: &str, arguments: &Value) -> Result<Value> {
        let service = self.0.services.get(path).ok_or(Error::Unsupported)?;
        if !arguments.is_object() {
            return Err(Error::Invalid);
        }
        let envelope = self
            .invoke(
                &service.entry,
                service.runtime,
                false,
                &json!({"service":path,"arguments":arguments}),
            )
            .await?;
        Ok(envelope["result"].clone())
    }
    async fn invoke(
        &self,
        entry: &Path,
        runtime: Runtime,
        writes: bool,
        request: &Value,
    ) -> Result<Value> {
        // Opening CAD starts capability and geometry requests together. Keep two
        // native processes, but queue a bounded burst instead of rejecting the
        // third normal startup request. Cancellation drops both reservations.
        let _pending = self
            .0
            .pending
            .try_acquire()
            .map_err(|_| Error::Unavailable)?;
        let _slot = tokio::time::timeout(Duration::from_secs(10), self.0.slots.acquire())
            .await
            .map_err(|_| Error::Unavailable)?
            .map_err(|_| Error::Unavailable)?;
        let bytes = serde_json::to_vec(request).map_err(|_| Error::Invalid)?;
        if bytes.len() > MAX_INPUT {
            return Err(Error::TooLarge);
        }
        let work = tempfile::tempdir().map_err(|_| Error::Unavailable)?;
        let (mut command, deadline) = match runtime {
            Runtime::Node => {
                let mut command = tokio::process::Command::new(&self.0.node);
                command.arg("--max-old-space-size=256").arg(entry);
                (command, 10)
            }
            Runtime::Python => {
                let mut command =
                    tokio::process::Command::new(self.0.python.as_ref().ok_or(Error::Invalid)?);
                command
                    .args(["-I", "-S"])
                    .arg(entry)
                    .arg(&self.0.node)
                    .arg(self.0.freecad.as_ref().ok_or(Error::Invalid)?);
                (command, 35)
            }
        };
        command
            .env_clear()
            .env("HOME", work.path())
            .env("TMPDIR", work.path())
            .env("QT_QPA_PLATFORM", "offscreen")
            .current_dir(work.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        #[cfg(unix)]
        command.process_group(0);
        let mut child = command.spawn().map_err(|_| Error::Unavailable)?;
        let _group = Group(child.id());
        let mut input = child.stdin.take().ok_or(Error::Unavailable)?;
        let output = child.stdout.take().ok_or(Error::Unavailable)?;
        let errors = child.stderr.take().ok_or(Error::Unavailable)?;
        tokio::time::timeout(Duration::from_secs(deadline), async {
            let write = async {
                input
                    .write_all(&bytes)
                    .await
                    .map_err(|_| Error::Unavailable)?;
                drop(input);
                Ok::<_, Error>(())
            };
            let wait = async { child.wait().await.map_err(|_| Error::Unavailable) };
            let (_, stdout, _, status) = tokio::try_join!(
                write,
                bounded(output, MAX_OUTPUT),
                bounded(errors, 65536),
                wait
            )?;
            if !status.success() {
                return Err(Error::Unavailable);
            }
            let value: Value = serde_json::from_slice(&stdout).map_err(|_| Error::Invalid)?;
            let object = value.as_object().ok_or(Error::Invalid)?;
            if object.contains_key("error") {
                return Err(if value["error"]["kind"] == "unavailable" {
                    Error::Unavailable
                } else if value["error"]["kind"] == "too_large" {
                    Error::TooLarge
                } else {
                    Error::Invalid
                });
            }
            if object
                .keys()
                .any(|k| !matches!(k.as_str(), "result" | "content" | "unchanged"))
                || !value["result"].is_object()
                || object.contains_key("content") && !writes
                || object.contains_key("unchanged")
                    && (value["unchanged"] != true || !writes || object.contains_key("content"))
                || writes && !object.contains_key("content") && value["unchanged"] != true
            {
                return Err(Error::Invalid);
            }
            if object.contains_key("content")
                && !value["content"].as_str().is_some_and(|s| {
                    s.len()
                        <= if request["content_encoding"] == "base64" {
                            MAX_CONTENT.div_ceil(3) * 4
                        } else {
                            MAX_CONTENT
                        }
                })
            {
                return Err(Error::TooLarge);
            }
            Ok(value)
        })
        .await
        .map_err(|_| Error::Unavailable)?
    }
}
async fn bounded(reader: impl AsyncRead + Unpin, limit: usize) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    reader
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .await
        .map_err(|_| Error::Unavailable)?;
    if bytes.len() > limit {
        return Err(Error::TooLarge);
    }
    Ok(bytes)
}
struct Group(Option<u32>);
impl Drop for Group {
    fn drop(&mut self) {
        #[cfg(unix)]
        if let Some(pid) = self
            .0
            .and_then(|id| rustix::process::Pid::from_raw(id as i32))
        {
            let _ = rustix::process::kill_process_group(pid, rustix::process::Signal::KILL);
        }
    }
}
// Explicit small schema vocabulary. Unsupported JSON Schema constructs fail at installation.
fn validate_schema(schema: &Value) -> Result<()> {
    let obj = schema.as_object().ok_or(Error::Invalid)?;
    if obj.keys().any(|k| {
        !matches!(
            k.as_str(),
            "type" | "properties" | "required" | "additionalProperties"
        )
    }) || schema["type"] != "object"
        || schema["additionalProperties"] != false
    {
        return Err(Error::Invalid);
    }
    let props = schema["properties"].as_object().ok_or(Error::Invalid)?;
    let req = schema["required"].as_array().ok_or(Error::Invalid)?;
    if props.len() > 64
        || req
            .iter()
            .any(|k| !k.as_str().is_some_and(|k| props.contains_key(k)))
    {
        return Err(Error::Invalid);
    }
    for def in props.values() {
        let d = def.as_object().ok_or(Error::Invalid)?;
        if d.keys().any(|k| {
            !matches!(
                k.as_str(),
                "type" | "enum" | "minLength" | "maxLength" | "minimum" | "maximum"
            )
        }) || !matches!(
            def["type"].as_str(),
            Some("string" | "integer" | "number" | "boolean")
        ) {
            return Err(Error::Invalid);
        }
        for bound in ["minimum", "maximum"] {
            if d.contains_key(bound) && !def[bound].as_f64().is_some_and(f64::is_finite) {
                return Err(Error::Invalid);
            }
        }
        for bound in ["minLength", "maxLength"] {
            if d.contains_key(bound) && def[bound].as_u64().is_none() {
                return Err(Error::Invalid);
            }
        }
        if d.contains_key("enum") && !def["enum"].as_array().is_some_and(|v| !v.is_empty()) {
            return Err(Error::Invalid);
        }
    }
    Ok(())
}
pub fn validate_arguments(arguments: &Value, schema: &Value) -> Result<()> {
    let fields = arguments.as_object().ok_or(Error::Invalid)?;
    let props = schema["properties"].as_object().ok_or(Error::Invalid)?;
    for key in schema["required"].as_array().ok_or(Error::Invalid)? {
        if !fields.contains_key(key.as_str().ok_or(Error::Invalid)?) {
            return Err(Error::Invalid);
        }
    }
    for (key, value) in fields {
        let def = props.get(key).ok_or(Error::Invalid)?;
        let valid = match def["type"].as_str() {
            Some("string") => value.as_str().is_some_and(|s| {
                s.chars().count() >= def["minLength"].as_u64().unwrap_or(0) as usize
                    && s.chars().count() <= def["maxLength"].as_u64().unwrap_or(65536) as usize
            }),
            Some("number" | "integer") => {
                (def["type"] != "integer" || value.as_i64().is_some() || value.as_u64().is_some())
                    && value.as_f64().is_some_and(|v| {
                        v.is_finite()
                            && v >= def["minimum"].as_f64().unwrap_or(f64::MIN)
                            && v <= def["maximum"].as_f64().unwrap_or(f64::MAX)
                    })
            }
            Some("boolean") => value.is_boolean(),
            _ => false,
        };
        if !valid || def["enum"].as_array().is_some_and(|e| !e.contains(value)) {
            return Err(Error::Invalid);
        }
    }
    Ok(())
}
