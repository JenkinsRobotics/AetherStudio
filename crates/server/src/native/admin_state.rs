//! Administrative envelope for the existing UI. Unsupported operational adapters
//! are explicit null/capability values, never fictitious backups or settings.
use super::{
    NativeHost,
    boundary::{Result, token},
};
use crate::documents::Error;
use axum::{Json, extract::State, http::HeaderMap};
use serde_json::{Value, json};
pub(super) async fn read(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    let mut state = docs.admin_directory(&session).await?;
    let settings = host.settings.as_ref().ok_or(Error::Unavailable)?;
    let presentation = settings.read(&session).await?.presentation;
    state["applications"] = json!(
        host.catalog
            .iter()
            .filter(|app| state["application_enabled"].get(&app.id).is_some())
            .map(|app| super::status::application(
                &host,
                app,
                state["application_enabled"][&app.id]
                    .as_bool()
                    .unwrap_or(false)
            ))
            .collect::<Vec<_>>()
    );
    state.as_object_mut().unwrap().remove("application_enabled");
    state["mail"] = if host.mail.is_some() {
        settings.mail_read(&session).await?
    } else {
        Value::Null
    };
    let events = settings.mail_events(&session).await?;
    let audit = state["audit"].as_array_mut().unwrap();
    for event in events.as_array().unwrap() {
        let mut event = event.clone();
        event["target"] = json!("");
        audit.push(event);
    }
    audit.sort_by(|a, b| {
        b["time"]
            .as_f64()
            .partial_cmp(&a["time"].as_f64())
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    audit.truncate(100);
    for (i, event) in audit.iter_mut().enumerate() {
        event["id"] = json!(i);
    }
    state["runtime"] = json!("rust");
    state["settings"] = Value::Null;
    state["running_settings"]=host.listen_address.map(|address|json!({"name":presentation.name,"bind_address":address.ip().to_string(),"port":address.port(),"public_url":host.origin,"tls_cert":"","tls_key":""})).unwrap_or(Value::Null);
    state["public_url"] = json!(host.origin);
    state["restart_required"] = json!(false);
    if let Some(network) = &host.network {
        let (pending, running, changed) = network.state().await?;
        state["settings"] = json!(pending);
        state["running_settings"] = json!(running);
        state["restart_required"] = json!(changed);
    }
    state["uptime_s"] = json!(host.started.elapsed().as_secs());
    state["services"] = docs.services(&session, None).await?;
    state["service_apps"] = json!(crate::documents::automation::APPS);
    let (storage, backups) = if let Some(backups) = &host.backups {
        backups.state().await?
    } else {
        (Value::Null, Value::Null)
    };
    state["storage"] = storage;
    state["backups"] = backups;
    state["capabilities"] = json!({"mail":host.mail.is_some(),"network_settings":host.network.is_some(),"backups":host.backups.is_some(),"service_accounts":true,"maintenance":true});
    Ok(Json(state))
}
