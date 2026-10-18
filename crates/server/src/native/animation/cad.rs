//! CAD document sessions over the installed container codec. CAD permission and
//! handles are separate from Animation; all file persistence uses Studio APIs.
use super::*;

fn permitted(input: &Value) -> bool {
    let Some(method) = input["method"].as_str() else {
        return false;
    };
    if !input["params"].is_object() || input["params"].get("path").is_some() {
        return false;
    }
    match method {
        "load_workspace" => input["params"]["data_base64"].is_string(),
        "save_workspace" => input["params"]["return_data"] == true,
        "new_workspace"
        | "release"
        | "describe_assembly"
        | "project_bom"
        | "solve_assembly"
        | "preview_mate"
        | "add_part_definition"
        | "update_part_definition"
        | "remove_part_definition"
        | "add_instance"
        | "update_instance"
        | "remove_instance"
        | "move_instance"
        | "set_instance_grounded"
        | "set_instance_suppressed"
        | "add_connector"
        | "update_connector"
        | "remove_connector"
        | "add_mate"
        | "update_mate"
        | "remove_mate"
        | "add_relation"
        | "update_relation"
        | "remove_relation"
        | "set_dof_value" => true,
        _ => false,
    }
}

async fn authorize_cad(host: &NativeHost, session: &str) -> Result<()> {
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    if session.starts_with("aether_sa_") || session.starts_with("aether_agent_") {
        return Ok(docs.service_application_access(session, "cad").await?);
    }
    let (status, apps) = docs.application_status(Some(session), &["cad"]).await?;
    if status.user.is_none() {
        return Err(aether_identity::Error::Unauthorized.into());
    }
    if !apps.iter().any(|app| app == "cad") {
        return Err(aether_identity::Error::Forbidden.into());
    }
    Ok(())
}

pub(in crate::native) async fn rpc(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = if headers.contains_key("authorization") {
        agent_token(&headers)?
    } else {
        token(&headers)?
    };
    if !headers.contains_key("authorization")
        && (session.starts_with("aether_sa_") || session.starts_with("aether_agent_"))
    {
        return Err(aether_identity::Error::Unauthorized.into());
    }
    let key = format!("cad:{:x}", Sha256::digest(session.as_bytes()));
    let runtime = host.animation.as_ref().ok_or(Error::Unavailable)?;
    if let Err(error) = authorize_cad(&host, &session).await {
        runtime.forget(&key).await;
        return Err(error);
    }
    let input = body(input)?;
    if !permitted(&input) {
        return Err(Error::Invalid.into());
    }
    let result = runtime.invoke(&key, &input).await;
    if let Err(error) = authorize_cad(&host, &session).await {
        runtime.forget(&key).await;
        return Err(error);
    }
    Ok(Json(result?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn permits_only_memory_assembly_commands() {
        for method in ["new_workspace", "describe_assembly", "add_mate", "release"] {
            assert!(permitted(&json!({"method":method,"params":{}})));
        }
        assert!(permitted(
            &json!({"method":"load_workspace","params":{"data_base64":"archive"}})
        ));
        assert!(permitted(
            &json!({"method":"save_workspace","params":{"return_data":true}})
        ));
        for input in [
            json!({"method":"shutdown","params":{}}),
            json!({"method":"canvas2d.new","params":{}}),
            json!({"method":"load_workspace","params":{"path":"private.anima"}}),
            json!({"method":"load_workspace","params":{"data_base64":"archive","path":"private.anima"}}),
            json!({"method":"save_workspace","params":{"return_data":false}}),
            json!({"method":"new_workspace","params":[]}),
        ] {
            assert!(!permitted(&input), "{input}");
        }
    }
}
