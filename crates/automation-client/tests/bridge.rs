use aether_automation_client::{Client, MAX_INPUT, mcp::Server};
use serde_json::{Value, json};
use std::{
    io::{BufRead, BufReader, Cursor, Read, Write},
    net::TcpListener,
    process::{Command, Stdio},
    thread,
};

const TOKEN: &str = "aether_agent_fixture_only";
fn client() -> Client {
    Client::new("http://127.0.0.1:1", TOKEN).unwrap()
}
fn init() -> Value {
    json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"fixture","version":"1"}}})
}
fn ready(server: &mut Server) {
    server.handle(init()).unwrap();
    assert!(
        server
            .handle(json!({"jsonrpc":"2.0","method":"notifications/initialized"}))
            .is_none()
    );
}
fn one_response(
    status: &str,
    headers: &str,
    body: Vec<u8>,
) -> (String, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let head = format!(
        "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n{headers}\r\n",
        body.len()
    );
    let task = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(5)))
            .unwrap();
        let mut reader = BufReader::new(&stream);
        let mut request = String::new();
        let mut length = 0;
        loop {
            let mut line = String::new();
            reader.read_line(&mut line).unwrap();
            if line.to_ascii_lowercase().starts_with("content-length:") {
                length = line
                    .split(':')
                    .nth(1)
                    .unwrap()
                    .trim()
                    .parse::<usize>()
                    .unwrap();
            }
            request.push_str(&line);
            if line == "\r\n" {
                break;
            }
        }
        let mut payload = vec![0; length];
        reader.read_exact(&mut payload).unwrap();
        request.push_str(std::str::from_utf8(&payload).unwrap());
        drop(reader);
        // A bounded client is allowed to close without reading an oversized body.
        let _ = stream.write_all(head.as_bytes());
        let _ = stream.write_all(&body);
        request
    });
    (url, task)
}
#[test]
fn rejects_nonliteral_origins_and_secrets_in_urls() {
    for url in [
        "http://127.1:8781",
        "http://2130706433:8781",
        "http://0x7f000001:8781",
        "https://127.0.0.1:8781",
        "http://127.0.0.1:0",
        "http://127.0.0.1:65536",
        "http://127.0.0.1:8781/?",
        "http://127.0.0.1:8781/#",
        "http://127.0.0.1:8781/../",
        "http://user@127.0.0.1:8781",
        "http://127.0.0.1:8781/path",
    ] {
        assert!(Client::new(url, TOKEN).is_err(), "{url}");
    }
    assert!(Client::new("http://127.0.0.1:80/", TOKEN).is_ok());
    assert!(Client::new("http://localhost:8780", TOKEN).is_ok());
}
#[test]
fn rejects_invalid_tokens_without_echoing_them() {
    for token in [
        "secret-do-not-show",
        "aether_agent_",
        "aether_agent_abc\nsecret",
        "aether_agent_é",
    ] {
        let Err(error) = Client::new("http://127.0.0.1:8781", token) else {
            panic!("accepted")
        };
        assert!(!error.to_string().contains(token));
    }
}
#[test]
fn lifecycle_and_protocol_errors() {
    let mut server = Server::new(client());
    assert_eq!(
        server
            .handle(json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}))
            .unwrap()["error"]["code"],
        -32000
    );
    ready(&mut server);
    assert_eq!(server.handle(init()).unwrap()["error"]["code"], -32600);
    for frame in [
        json!([]),
        json!({"jsonrpc":"2.0","id":true,"method":"ping"}),
        json!({"jsonrpc":"2.0","id":null,"method":"ping"}),
    ] {
        assert_eq!(server.handle(frame).unwrap()["error"]["code"], -32600);
    }
    assert_eq!(
        server
            .handle(json!({"jsonrpc":"2.0","id":"x","method":"ping"}))
            .unwrap()["result"],
        json!({})
    );
    assert_eq!(
        server
            .handle(json!({"jsonrpc":"2.0","id":3,"method":"resources/list"}))
            .unwrap()["error"]["code"],
        -32601
    );
    assert_eq!(
        server
            .handle(json!({"jsonrpc":"2.0","id":4,"method":"tools/list","params":{"cursor":"x"}}))
            .unwrap()["error"]["code"],
        -32602
    );
    assert_eq!(server.handle(json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"x","arguments":[]}})).unwrap()["error"]["code"],-32602);
}
#[test]
fn framing_recovers_after_oversize_bad_utf8_nan_and_nested_json() {
    let mut data = vec![b'x'; MAX_INPUT + 100];
    data.push(b'\n');
    data.extend_from_slice(b"\xff\n{\"a\":NaN}\n");
    data.extend(vec![b'['; 256]);
    data.extend(vec![b']'; 256]);
    data.push(b'\n');
    data.extend_from_slice(b"{\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"ping\"}\n");
    let mut out = Vec::new();
    Server::new(client())
        .serve(BufReader::with_capacity(7, Cursor::new(data)), &mut out)
        .unwrap();
    let replies: Vec<Value> = String::from_utf8(out)
        .unwrap()
        .lines()
        .map(|s| serde_json::from_str(s).unwrap())
        .collect();
    assert_eq!(replies.len(), 5);
    assert_eq!(replies[0]["error"]["code"], -32600);
    for reply in &replies[1..4] {
        assert_eq!(reply["error"]["code"], -32700);
    }
    assert_eq!(replies[4]["id"], 9);
}
#[test]
fn transport_uses_only_fixed_command_route_and_bearer_header() {
    let (url, task) = one_response(
        "200 OK",
        "Content-Type: application/json\r\n",
        b"{\"result\":{\"revision\":2}}".to_vec(),
    );
    assert_eq!(
        Client::new(&url, TOKEN)
            .unwrap()
            .call(
                "run",
                &json!({"id":"document.rename","arguments":{"name":"テスト"}})
            )
            .unwrap()["result"]["revision"],
        2
    );
    let request = task.join().unwrap();
    assert!(request.starts_with("POST /api/automation/commands/run HTTP/1.1"));
    assert!(request.contains(&format!("authorization: Bearer {TOKEN}")));
    assert!(!request.lines().next().unwrap().contains(TOKEN));
    assert!(client().call("../admin", &json!({})).is_err());
}
#[test]
fn redirect_is_refused_and_diagnostics_are_not_echoed() {
    let (url, task) = one_response(
        "307 Temporary Redirect",
        "Location: http://127.0.0.1:1/steal\r\n",
        TOKEN.as_bytes().to_vec(),
    );
    let e = Client::new(&url, TOKEN)
        .unwrap()
        .call("run", &json!({}))
        .unwrap_err();
    assert_eq!(e.status, 307);
    assert!(!e.to_string().contains(TOKEN));
    task.join().unwrap();
}
#[test]
fn refused_commands_do_not_echo_server_payloads() {
    for status in ["401 Unauthorized", "403 Forbidden", "409 Conflict"] {
        let (url, task) = one_response(
            status,
            "",
            format!("{{\"error\":\"{TOKEN}\"}}").into_bytes(),
        );
        let e = Client::new(&url, TOKEN)
            .unwrap()
            .call("run", &json!({}))
            .unwrap_err();
        assert_eq!(e.status.to_string(), &status[..3]);
        assert!(!e.to_string().contains(TOKEN));
        task.join().unwrap();
    }
}
#[test]
fn rejects_malformed_or_oversized_host_results() {
    for body in [
        b"not json".to_vec(),
        b"[]".to_vec(),
        vec![b' '; 8 * 1024 * 1024 + 1],
    ] {
        let (url, task) = one_response("200 OK", "", body);
        assert_eq!(
            Client::new(&url, TOKEN)
                .unwrap()
                .call("run", &json!({}))
                .unwrap_err()
                .status,
            502
        );
        task.join().unwrap();
    }
}
#[test]
fn catalog_schema_and_ambiguous_names_fail_closed() {
    let descriptor = json!({"id":"map.show.inspect","title":"Inspect","description":"Read","inputSchema":{"type":"object"},"annotations":{"readOnlyHint":true}});
    for body in [
        json!({}),
        json!({"apps":["map"],"commands":[descriptor.clone(),descriptor.clone()]}),
        json!({"apps":[],"commands":[{"id":"map_show","title":"x","description":"x","inputSchema":{},"annotations":{}}]}),
    ] {
        let (url, task) = one_response("200 OK", "", body.to_string().into_bytes());
        assert!(Client::new(&url, TOKEN).unwrap().catalog().is_err());
        task.join().unwrap();
    }
    let (url, task) = one_response(
        "200 OK",
        "",
        json!({"apps":["map"],"commands":[descriptor]})
            .to_string()
            .into_bytes(),
    );
    let mut server = Server::new(Client::new(&url, TOKEN).unwrap());
    ready(&mut server);
    let result = server
        .handle(json!({"jsonrpc":"2.0","id":7,"method":"tools/list"}))
        .unwrap();
    assert_eq!(result["result"]["tools"][0]["name"], "map_show_inspect");
    task.join().unwrap();
}
#[test]
fn transport_loss_reports_unknown_edit_outcome() {
    let e = client().call("run", &json!({})).unwrap_err();
    assert!(e.message.contains("outcome is unknown"));
}
#[test]
fn cli_rejects_invalid_arguments_and_keeps_stdout_clean() {
    for input in [
        b"[]".to_vec(),
        b"{\"value\":NaN}".to_vec(),
        vec![b'x'; MAX_INPUT + 1],
    ] {
        let mut child = Command::new(env!("CARGO_BIN_EXE_aether-agent"))
            .args(["run", "document.rename"])
            .env("AETHER_AUTOMATION_TOKEN", TOKEN)
            .env("AETHER_SERVER_URL", "http://127.0.0.1:1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(&input).unwrap();
        let output = child.wait_with_output().unwrap();
        assert!(!output.status.success());
        assert!(output.stdout.is_empty());
        assert!(!String::from_utf8(output.stderr).unwrap().contains(TOKEN));
    }
}
#[test]
fn cli_ignores_proxy_environment() {
    let (url, task) = one_response("200 OK", "", b"{\"commands\":[],\"apps\":[]}".to_vec());
    let output = Command::new(env!("CARGO_BIN_EXE_aether-agent"))
        .arg("list")
        .env("AETHER_AUTOMATION_TOKEN", TOKEN)
        .env("AETHER_SERVER_URL", url)
        .env("HTTP_PROXY", "http://127.0.0.1:1")
        .env("http_proxy", "http://127.0.0.1:1")
        .env("ALL_PROXY", "http://127.0.0.1:1")
        .env("NO_PROXY", "")
        .env("no_proxy", "")
        .output()
        .unwrap();
    assert!(output.status.success());
    task.join().unwrap();
}

#[test]
fn explicit_retry_ids_require_server_capability_and_write_permission() {
    let descriptor = json!({"id":"document.rename","title":"Rename","description":"Rename file","inputSchema":{"type":"object"},"annotations":{"readOnlyHint":false}});
    for enabled in [false, true] {
        let (url,task)=one_response("200 OK","",json!({"apps":["map"],"commands":[descriptor],"capabilities":{"operation_receipts":enabled}}).to_string().into_bytes());
        let catalog = Client::new(&url, TOKEN).unwrap().catalog().unwrap();
        let invocation =
            catalog.invocation("document.rename", &json!({}), Some("stable-operation"));
        assert_eq!(invocation.is_ok(), enabled);
        if enabled {
            assert_eq!(invocation.unwrap()["operation_id"], "stable-operation");
        }
        for invalid in ["", "bad/id", "with space", "é"] {
            assert!(
                catalog
                    .invocation("document.rename", &json!({}), Some(invalid))
                    .is_err()
            );
        }
        assert!(
            catalog
                .invocation("unavailable", &json!({}), Some("id"))
                .is_err()
        );
        task.join().unwrap();
    }
    let (url, task) = one_response(
        "200 OK",
        "",
        json!({"apps":["map"],"commands":[],"capabilities":{"operation_receipts":true}})
            .to_string()
            .into_bytes(),
    );
    let catalog = Client::new(&url, TOKEN).unwrap().catalog().unwrap();
    assert!(
        catalog
            .invocation("document.inspect", &json!({}), Some("id"))
            .is_err()
    );
    task.join().unwrap();
}
#[test]
fn cli_never_sends_a_retry_id_to_an_older_host() {
    let (url, task) = one_response(
        "200 OK",
        "",
        json!({"apps":["map"],"commands":[]})
            .to_string()
            .into_bytes(),
    );
    let mut child = Command::new(env!("CARGO_BIN_EXE_aether-agent"))
        .args([
            "run",
            "document.rename",
            "--operation-id",
            "stable-operation",
        ])
        .env("AETHER_AUTOMATION_TOKEN", TOKEN)
        .env("AETHER_SERVER_URL", url)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap().write_all(b"{}").unwrap();
    let out = child.wait_with_output().unwrap();
    assert!(!out.status.success());
    assert!(out.stdout.is_empty());
    assert!(
        String::from_utf8(out.stderr)
            .unwrap()
            .contains("No edit was sent")
    );
    assert!(
        task.join()
            .unwrap()
            .starts_with("POST /api/automation/commands/list ")
    );
}

#[test]
fn localhost_keeps_configured_host_and_pins_loopback() {
    let (origin, task) = one_response(
        "200 OK",
        "Content-Type: application/json\r\n",
        b"{}".to_vec(),
    );
    let origin = origin.replace("127.0.0.1", "localhost");
    let result = Client::new(&origin, TOKEN)
        .unwrap()
        .call("list", &json!({}))
        .unwrap();
    assert_eq!(result, json!({}));
    assert!(
        task.join()
            .unwrap()
            .to_ascii_lowercase()
            .contains("host: localhost:")
    );
}
