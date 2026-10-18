use super::*;
use std::{
    process::Stdio,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader},
    process::Command,
};

const HOST_LEASE: &str = r#"
                import { pathToFileURL } from 'node:url';
                // The private stdin pipe is also the host-lifetime lease. An
                // abrupt host exit must not leave an OAuth/chat process behind.
                process.stdin.on('end', () => {
                    try { process.kill(-process.pid, 'SIGKILL'); } catch {}
                    process.exit(1);
                });
                await import(pathToFileURL(process.argv[1]).href);
            "#;

impl Agents {
    pub(super) async fn run(
        &self,
        job: Arc<Job>,
        authority: Authority,
        directory: PathBuf,
        payload: Option<Value>,
        mut cancel: watch::Receiver<bool>,
        mut input: mpsc::Receiver<Zeroizing<String>>,
    ) {
        let result = self
            .process(
                &job,
                &authority,
                &directory,
                payload,
                &mut cancel,
                &mut input,
            )
            .await;
        // Serialize publication with disable/disconnect/uninstall. A cancelled
        // sign-in must never resurrect an account after the administrator's action.
        let state = self.0.state.lock().await;
        let mut public = job.public.lock().await;
        if *cancel.borrow()
            || !state.settings[job.provider].enabled
            || self.0.stopped.load(Ordering::SeqCst)
        {
            public.state = "cancelled";
        } else {
            match result {
                Ok(label) => {
                    let saved = if job.kind == "login" {
                        match label {
                            Some(label) => storage::write(
                                &directory.join("connection.json"),
                                &Account {
                                    connected: true,
                                    label,
                                    verified_at: SystemTime::now()
                                        .duration_since(UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_secs(),
                                },
                            ),
                            None => Err(Error::Unavailable),
                        }
                    } else {
                        Ok(())
                    };
                    if saved.is_ok() {
                        public.state = "completed";
                    } else {
                        public.state = "failed";
                        public.error =
                            "The provider connection could not be saved. Reconnect in Plugins."
                                .into();
                    }
                }
                Err(Error::Forbidden) => {
                    public.state = "cancelled";
                    public.error = "The request lost access to this workspace or account.".into();
                }
                Err(_) => {
                    public.state = "failed";
                    public.error = "The provider request failed or exceeded its limits. Check the Studio runtime and reconnect in Plugins.".into();
                }
            }
        }
        public.login = None;
        public.tool_call = None;
        job.finished.store(true, Ordering::SeqCst);
    }
    async fn process(
        &self,
        job: &Job,
        authority: &Authority,
        directory: &Path,
        payload: Option<Value>,
        cancel: &mut watch::Receiver<bool>,
        input: &mut mpsc::Receiver<Zeroizing<String>>,
    ) -> Result<Option<String>> {
        if *cancel.borrow() {
            return Err(Error::Forbidden);
        }
        authority.user().await?;
        let provider_dir = directory.join(job.provider);
        storage::private_dir(&provider_dir)?;
        let (adapter, cli) = self
            .0
            .configuration
            .adapter(job.provider)
            .ok_or(Error::Unsupported)?;
        let mut command = Command::new(&self.0.configuration.node);
        command
            .args(["--input-type=module", "--eval", HOST_LEASE])
            .arg(adapter)
            .arg(&job.kind)
            .arg(&provider_dir)
            .env_clear()
            .env("HOME", directory)
            .env("TMPDIR", directory)
            .env("LANG", "en_US.UTF-8")
            .current_dir(directory)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        if let Some(cli) = cli {
            command.arg(cli);
        }
        // This adapter needs no shell, inherited API key, runtime flags or host tools.
        #[cfg(unix)]
        command.process_group(0);
        let mut child = command.spawn().map_err(|_| Error::Unavailable)?;
        #[cfg(unix)]
        let pid = child.id();
        let mut stdin = child.stdin.take().ok_or(Error::Unavailable)?;
        let stdout = child.stdout.take().ok_or(Error::Unavailable)?;
        let mut reader = BufReader::new(stdout);
        let result = async {
            if let Some(payload) = payload {
                let line = Zeroizing::new(payload.to_string() + "\n");
                tokio::time::timeout(Duration::from_secs(5), stdin.write_all(line.as_bytes())).await.map_err(|_| Error::Unavailable)?.map_err(|_| Error::Unavailable)?;
            }
            let deadline = tokio::time::sleep(Duration::from_secs(600)); tokio::pin!(deadline);
            let mut ticks = tokio::time::interval(Duration::from_secs(1)); ticks.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            let mut label = None; let mut done = false; let mut bytes = 0usize;
            let mut tool_ids = std::collections::HashSet::new();
            loop {
                // read_until is cancellation-safe. Retain partial data when an
                // authority tick or callback write wins this select.
                let mut line = Vec::new();
                let count = {
                let event = async {
                    let count = (&mut reader).take(65537).read_until(b'\n', &mut line).await.map_err(|_| Error::Unavailable)?;
                    if count > 65536 { return Err(Error::Unavailable); }
                    Ok(count)
                };
                tokio::pin!(event);
                loop {
                    tokio::select! {
                        biased;
                        _ = cancel.changed() => return Err(Error::Forbidden),
                        _ = &mut deadline => return Err(Error::Unavailable),
                        _ = ticks.tick() => {
                            tokio::time::timeout(Duration::from_secs(5), authority.user()).await.map_err(|_| Error::Forbidden)??;
                        }
                        Some(code) = input.recv() => {
                            tokio::time::timeout(Duration::from_secs(2), stdin.write_all((code.to_string()+"\n").as_bytes())).await.map_err(|_| Error::Unavailable)?.map_err(|_| Error::Unavailable)?;
                        }
                        count = &mut event => break count?,
                    }
                }
                };
                if count == 0 { break; }
                bytes += count;
                if bytes > 2 * 1024 * 1024 { return Err(Error::Unavailable); }
                let event: Value = serde_json::from_slice(&line).map_err(|_| Error::Unavailable)?;
                let mut public = job.public.lock().await;
                if *cancel.borrow() { return Err(Error::Forbidden); }
                match event["type"].as_str() {
                    Some("delta") if job.kind == "chat" => {
                        let text = event["text"].as_str().ok_or(Error::Unavailable)?;
                        if public.text.len() + text.len() > 200000 { return Err(Error::Unavailable); }
                        public.text.push_str(text);
                    }
                    Some("tool_call") if job.kind == "chat" => {
                        let call = tools::ToolCall::parse(&event, &job.tools)?;
                        if public.tool_call.is_some() || tool_ids.len() >= tools::MAX_CALLS || !tool_ids.insert(call.id.clone()) { return Err(Error::Invalid); }
                        public.tool_call = Some(call);
                    }
                    Some("connected") if job.kind == "login" => {
                        let name = event["label"].as_str().filter(|s| !s.is_empty() && s.len() <= 254 && !s.chars().any(char::is_control)).ok_or(Error::Unavailable)?;
                        label = Some(name.to_owned());
                    }
                    Some("login") if job.kind == "login" => {
                        let url = event["url"].as_str().filter(|s| s.len() <= 12000).ok_or(Error::Unavailable)?;
                        let parsed = reqwest::Url::parse(url).map_err(|_| Error::Unavailable)?;
                        let host_allowed = match job.provider {
                            "chatgpt" => parsed.host_str() == Some("auth.openai.com"),
                            "claude" => matches!(parsed.host_str(), Some("claude.ai" | "platform.claude.com" | "console.anthropic.com")),
                            "gemini" => parsed.host_str() == Some("accounts.google.com"),
                            _ => false,
                        };
                        if parsed.scheme() != "https" || !host_allowed || !parsed.username().is_empty() || parsed.password().is_some() || parsed.port().is_some_and(|p| p != 443) { return Err(Error::Unavailable); }
                        let callback = job.provider == "chatgpt";
                        public.login = Some(json!({"url":url,"instruction":if callback {"Complete sign-in in your browser. If the final localhost page cannot open, paste that full callback URL here."} else {"Complete sign-in in a browser on the Studio host. This provider uses a local callback."},"acceptsCode":callback}));
                    }
                    Some("models") if job.kind == "models" => {
                        let models = event["models"].as_array().filter(|m| m.len() <= 100).ok_or(Error::Unavailable)?;
                        public.models = models.iter().map(|m| {
                            let id = m["id"].as_str().filter(|s| (job.provider != "chatgpt" || !s.is_empty()) && s.len() <= 120 && !s.chars().any(char::is_control)).ok_or(Error::Unavailable)?;
                            let name = m["name"].as_str().filter(|s| s.len() <= 200).ok_or(Error::Unavailable)?;
                            Ok(json!({"id":id,"name":name}))
                        }).collect::<Result<_>>()?;
                    }
                    Some("done") if public.tool_call.is_none() => done = true,
                    _ => return Err(Error::Unavailable),
                }
            }
            let status = loop {
                tokio::select! {
                    biased;
                    _ = cancel.changed() => return Err(Error::Forbidden),
                    _ = &mut deadline => return Err(Error::Unavailable),
                    _ = ticks.tick() => {
                        tokio::time::timeout(Duration::from_secs(5), authority.user()).await.map_err(|_| Error::Forbidden)??;
                    }
                    result = child.wait() => break result.map_err(|_| Error::Unavailable)?,
                }
            };
            if !status.success() || !done { return Err(Error::Unavailable); }
            authority.user().await?;
            Ok(label)
        }.await;
        // Always remove the process group, including any inherited pipe holder.
        #[cfg(unix)]
        if let Some(pid) = pid.and_then(|p| rustix::process::Pid::from_raw(p as i32)) {
            let _ = rustix::process::kill_process_group(pid, rustix::process::Signal::KILL);
        }
        let _ = child.kill().await;
        let _ = tokio::time::timeout(Duration::from_secs(2), child.wait()).await;
        result
    }
}

impl Agents {
    pub(super) async fn check_runtime(&self) -> Result<()> {
        let mut child = Command::new(&self.0.configuration.node)
            .arg("--version")
            .env_clear()
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .map_err(|_| Error::Unavailable)?;
        tokio::time::timeout(Duration::from_secs(5), async {
            let mut output = String::new();
            child
                .stdout
                .take()
                .ok_or(Error::Unavailable)?
                .take(128)
                .read_to_string(&mut output)
                .await
                .map_err(|_| Error::Unavailable)?;
            let status = child.wait().await.map_err(|_| Error::Unavailable)?;
            let version = output
                .trim()
                .strip_prefix('v')
                .and_then(|v| v.split('.').next())
                .and_then(|v| v.parse::<u32>().ok());
            if status.success() && version.is_some_and(|v| v >= 22) {
                Ok(())
            } else {
                Err(Error::Unavailable)
            }
        })
        .await
        .map_err(|_| Error::Unavailable)?
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    #[tokio::test]
    async fn official_cli_login_adapters_stop_with_the_host_lifetime_pipe() {
        let package = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let executable = std::process::Command::new("node")
            .args(["-p", "process.execPath"])
            .output()
            .unwrap();
        assert!(executable.status.success());
        let node = String::from_utf8(executable.stdout).unwrap();
        for provider in ["claude", "gemini"] {
            let root = tempfile::tempdir().unwrap();
            std::fs::write(root.path().join("behavior.txt"), "hang-login").unwrap();
            let mut child = Command::new(node.trim())
                .args(["--input-type=module", "--eval", HOST_LEASE])
                .arg(package.join(format!("providers/{provider}.mjs")))
                .arg("login")
                .arg(root.path())
                .arg(package.join("tests/native_documents/official_cli_fixture.mjs"))
                .env_clear()
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .kill_on_drop(true)
                .process_group(0)
                .spawn()
                .unwrap();
            let pid = rustix::process::Pid::from_raw(child.id().unwrap() as i32).unwrap();
            let mut reader = BufReader::new(child.stdout.take().unwrap());
            let mut line = String::new();
            let first =
                tokio::time::timeout(Duration::from_secs(5), reader.read_line(&mut line)).await;
            if first.is_err()
                || first
                    .as_ref()
                    .is_ok_and(|r| r.as_ref().is_ok_and(|n| *n == 0))
            {
                let _ = rustix::process::kill_process_group(pid, rustix::process::Signal::KILL);
            }
            assert!(
                first.unwrap().unwrap() > 0,
                "{provider} login did not start"
            );
            assert_eq!(
                serde_json::from_str::<Value>(&line).unwrap()["type"],
                "login"
            );
            let cli: Value =
                serde_json::from_slice(&std::fs::read(root.path().join("process.json")).unwrap())
                    .unwrap();
            drop(child.stdin.take());
            let stopped = tokio::time::timeout(Duration::from_secs(3), child.wait()).await;
            if stopped.is_err() {
                let _ = rustix::process::kill_process_group(pid, rustix::process::Signal::KILL);
            }
            assert!(!stopped.unwrap().unwrap().success());
            let cli_pid =
                rustix::process::Pid::from_raw(cli["pid"].as_i64().unwrap() as i32).unwrap();
            tokio::time::timeout(Duration::from_secs(3), async {
                while rustix::process::test_kill_process(cli_pid).is_ok() {
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }
            })
            .await
            .unwrap();
        }
    }
    #[tokio::test]
    async fn host_pipe_closure_terminates_orphan_runtime() {
        let root = tempfile::tempdir().unwrap();
        let script = root.path().join("lease.mjs");
        std::fs::write(
            &script,
            "process.stdin.resume(); console.log('ready'); setInterval(() => {}, 1000);",
        )
        .unwrap();
        let mut child = Command::new("node")
            .args(["--input-type=module", "--eval", HOST_LEASE])
            .arg(&script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .process_group(0)
            .spawn()
            .unwrap();
        let mut reader = BufReader::new(child.stdout.take().unwrap());
        let mut line = String::new();
        tokio::time::timeout(Duration::from_secs(5), reader.read_line(&mut line))
            .await
            .unwrap()
            .unwrap();
        assert_eq!(line.trim(), "ready");
        drop(child.stdin.take());
        let status = tokio::time::timeout(Duration::from_secs(3), child.wait())
            .await
            .unwrap()
            .unwrap();
        assert!(!status.success());
    }
}
