//! Developer SQLite reference fixture. Not part of any standalone app.
use aether_protocol_core::storage::DocumentMutation;
use aether_store::LocalStore;
use serde_json::{Value, json};
use std::{
    io::{self, Read},
    path::PathBuf,
    process::ExitCode,
};

fn run() -> Result<Value, Box<dyn std::error::Error>> {
    let mut args = std::env::args_os().skip(1);
    let path = PathBuf::from(args.next().ok_or(
        "usage: aether-store-fixture FIXTURE.sqlite mutate|read|history|verify|backup [ID|DESTINATION]",
    )?);
    let command = args.next().ok_or("Missing command")?;
    let extra = args.next();
    if args.next().is_some() {
        return Err("Too many arguments".into());
    }
    let command = command.to_str().ok_or("Invalid command")?;
    if !matches!(command, "mutate" | "read" | "history" | "verify" | "backup") {
        return Err("Unknown local command".into());
    }
    if matches!(command, "mutate" | "verify") == extra.is_some() {
        return Err("Incorrect command arguments".into());
    }
    // Only mutation initializes a new store. Reads never create an empty database.
    if command != "mutate" && !path.is_file() {
        return Err("Store does not exist".into());
    }
    let mutation = if command == "mutate" {
        let limit = (aether_store::MAX_CONTENT_BYTES.div_ceil(3) * 4 + 8192) as u64;
        let mut input = Vec::new();
        io::stdin().take(limit + 1).read_to_end(&mut input)?;
        if input.len() as u64 > limit {
            return Err("Mutation input exceeds limit".into());
        }
        Some(serde_json::from_slice::<DocumentMutation>(&input)?)
    } else {
        None
    };
    let mut store = LocalStore::open(path)?;
    let result = match command {
        "mutate" => serde_json::to_value(store.mutate(&mutation.unwrap())?)?,
        "read" => {
            serde_json::to_value(store.read(extra.unwrap().to_str().ok_or("Invalid ID")?, None)?)?
        }
        "history" => {
            serde_json::to_value(store.history(extra.unwrap().to_str().ok_or("Invalid ID")?)?)?
        }
        "verify" => serde_json::to_value(store.verify()?)?,
        "backup" => serde_json::to_value(store.backup(PathBuf::from(extra.unwrap()))?)?,
        _ => unreachable!(),
    };
    Ok(json!({"status":"success","result":result}))
}
fn main() -> ExitCode {
    match run() {
        Ok(value) => {
            println!("{value}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            let code = error
                .downcast_ref::<aether_store::StoreError>()
                .map(|e| serde_json::to_value(e.code).unwrap())
                .unwrap_or(json!("invalid_request"));
            println!(
                "{}",
                json!({"status":"error","code":code,"message":error.to_string()})
            );
            ExitCode::FAILURE
        }
    }
}
