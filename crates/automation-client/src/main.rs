use aether_automation_client::{Client, MAX_INPUT, mcp::Server};
use serde_json::{Value, json};
use std::io::{self, Read, Write};

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let help = "Usage: aether-agent list | run COMMAND [--operation-id ID] < arguments.json | mcp\nSet AETHER_SERVER_URL and AETHER_AUTOMATION_TOKEN privately in the environment.\nThis bridge requires Studio automation routes; it does not provide offline product editing.";
    if args == ["--help"] || args == ["-h"] {
        println!("{help}");
        return Ok(());
    }
    if !(args.len() == 1 && matches!(args[0].as_str(), "list" | "mcp")
        || args.len() == 2 && args[0] == "run"
        || args.len() == 4 && args[0] == "run" && args[2] == "--operation-id")
    {
        return Err(help.into());
    }
    let client = Client::environment()?;
    if args[0] == "mcp" {
        Server::new(client).serve(io::stdin().lock(), io::stdout().lock())?;
        return Ok(());
    }
    let value = if args[0] == "list" {
        client.call("list", &json!({}))?
    } else {
        if args[1].len() > 128 {
            return Err("Command name exceeds the limit.".into());
        }
        let mut input = Vec::new();
        io::stdin()
            .take(MAX_INPUT as u64 + 1)
            .read_to_end(&mut input)?;
        if input.len() > MAX_INPUT {
            return Err("Arguments exceed the 1 MiB limit.".into());
        }
        let arguments: Value =
            serde_json::from_slice(&input).map_err(|_| "Invalid argument JSON.")?;
        if !arguments.is_object() {
            return Err("Command arguments must be an object.".into());
        }
        let envelope = if args.len() == 4 {
            client
                .catalog()?
                .invocation(&args[1], &arguments, Some(&args[3]))?
        } else {
            json!({"id":args[1],"arguments":arguments})
        };
        client.call("run", &envelope)?
    };
    writeln!(
        io::stdout().lock(),
        "{}",
        serde_json::to_string_pretty(&value)?
    )?;
    Ok(())
}
fn main() {
    if let Err(e) = run() {
        if e.downcast_ref::<io::Error>()
            .is_some_and(|e| e.kind() == io::ErrorKind::BrokenPipe)
        {
            return;
        }
        eprintln!("{e}");
        std::process::exit(1);
    }
}
