//! Public OAuth clients: authorization code + S256, exact redirects and audience.
//! No provider passwords, client secrets, refresh tokens or network URL fetching.
use super::*;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use sha2::{Digest, Sha256};
use url::Url;

#[derive(Deserialize)]
pub struct Registration {
    pub client_name: String,
    pub redirect_uris: Vec<String>,
    pub token_endpoint_auth_method: Option<String>,
    pub grant_types: Option<Vec<String>>,
    pub response_types: Option<Vec<String>>,
}
#[derive(Serialize)]
pub struct Client {
    pub client_id: String,
    pub client_name: String,
    pub redirect_uris: Vec<String>,
    pub token_endpoint_auth_method: &'static str,
    pub grant_types: [&'static str; 1],
    pub response_types: [&'static str; 1],
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Authorization {
    pub client_id: String,
    pub redirect_uri: String,
    pub response_type: String,
    pub code_challenge: String,
    pub code_challenge_method: String,
    pub resource: String,
    #[serde(default)]
    pub state: String,
    pub scope: Option<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Exchange {
    pub grant_type: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub code: String,
    pub code_verifier: String,
    pub resource: String,
}
#[derive(Serialize)]
pub struct Consent {
    pub client_name: String,
    pub redirect_uri: String,
    pub resource: String,
}
pub fn valid_redirect(raw: &str) -> bool {
    if raw.len() > 2048 || raw.chars().any(char::is_control) {
        return false;
    }
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    url.username().is_empty()
        && url.password().is_none()
        && url.fragment().is_none()
        && url.host_str().is_some()
        && (url.scheme() == "https"
            || url.scheme() == "http"
                && matches!(url.host_str(), Some("127.0.0.1" | "[::1]" | "localhost")))
        && !url
            .query_pairs()
            .any(|(k, _)| matches!(k.as_ref(), "code" | "state" | "error"))
}
fn valid_id(id: &str) -> bool {
    id.len() == 64 && id.bytes().all(|b| b.is_ascii_hexdigit())
}
fn callback(redirect: &str, state: &str, code: Option<&str>) -> Result<String> {
    let mut url = Url::parse(redirect).map_err(|_| Error::InvalidInput)?;
    {
        let mut query = url.query_pairs_mut();
        if let Some(code) = code {
            query.append_pair("code", code);
        } else {
            query.append_pair("error", "access_denied");
        }
        if !state.is_empty() {
            query.append_pair("state", state);
        }
    }
    Ok(url.into())
}
impl Identity {
    pub async fn register_oauth_client(&self, input: Registration) -> Result<Client> {
        let name = input.client_name.trim();
        if name.is_empty()
            || name.len() > 80
            || name.chars().any(char::is_control)
            || !(1..=8).contains(&input.redirect_uris.len())
            || input.redirect_uris.iter().any(|uri| !valid_redirect(uri))
            || input
                .token_endpoint_auth_method
                .as_deref()
                .is_some_and(|s| s != "none")
            || input
                .grant_types
                .as_ref()
                .is_some_and(|v| v != &["authorization_code"])
            || input
                .response_types
                .as_ref()
                .is_some_and(|v| v != &["code"])
        {
            return Err(Error::InvalidInput);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(pg)?;
        self.lock(&tx).await?;
        // Repeated setup from the same client is idempotent and does not fill SQL.
        let previous = tx.query_opt("SELECT id FROM aether_identity.oauth_clients WHERE tenant=$1 AND name=$2 AND redirects=$3", &[&self.tenant, &name, &input.redirect_uris]).await.map_err(pg)?;
        let id = if let Some(row) = previous {
            row.get(0)
        } else {
            let row = tx.query_one("SELECT count(*), count(*) FILTER (WHERE created>clock_timestamp()-interval '1 hour') FROM aether_identity.oauth_clients WHERE tenant=$1", &[&self.tenant]).await.map_err(pg)?;
            if row.get::<_, i64>(0) >= 4096 || row.get::<_, i64>(1) >= 100 {
                return Err(Error::Throttled);
            }
            let id = random_hex::<32>()?;
            tx.execute("INSERT INTO aether_identity.oauth_clients(tenant,id,name,redirects) VALUES($1,$2,$3,$4)", &[&self.tenant, &id, &name, &input.redirect_uris]).await.map_err(pg)?;
            id
        };
        commit(tx).await?;
        Ok(Client {
            client_id: id,
            client_name: name.into(),
            redirect_uris: input.redirect_uris,
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code"],
            response_types: ["code"],
        })
    }
    pub async fn begin_oauth(&self, request: &Authorization, resource: &str) -> Result<String> {
        if !valid_id(&request.client_id)
            || request.resource != resource
            || request.response_type != "code"
            || request.code_challenge_method != "S256"
            || request.code_challenge.len() != 43
            || !request
                .code_challenge
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"-_".contains(&b))
            || request.state.len() > 512
            || request.state.chars().any(char::is_control)
            || request
                .scope
                .as_deref()
                .is_some_and(|s| !s.is_empty() && s != "aether")
        {
            return Err(Error::InvalidInput);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(pg)?;
        self.lock(&tx).await?;
        let client = tx.query_opt("SELECT id FROM aether_identity.oauth_clients WHERE tenant=$1 AND id=$2 AND $3=ANY(redirects)", &[&self.tenant,&request.client_id,&request.redirect_uri]).await.map_err(pg)?;
        if client.is_none() {
            return Err(Error::InvalidInput);
        }
        tx.execute("DELETE FROM aether_identity.oauth_requests WHERE tenant=$1 AND created<clock_timestamp()-interval '1 day'", &[&self.tenant]).await.map_err(pg)?;
        let count = tx.query_one("SELECT count(*),count(*) FILTER (WHERE expires>clock_timestamp()) FROM aether_identity.oauth_requests WHERE tenant=$1", &[&self.tenant]).await.map_err(pg)?;
        if count.get::<_, i64>(0) >= 4096 || count.get::<_, i64>(1) >= 256 {
            return Err(Error::Throttled);
        }
        let id = random_hex::<32>()?;
        tx.execute("INSERT INTO aether_identity.oauth_requests(tenant,id_hash,client_id,redirect_uri,resource,challenge,state) VALUES($1,$2,$3,$4,$5,$6,$7)", &[&self.tenant,&sha256(id.as_bytes()),&request.client_id,&request.redirect_uri,&request.resource,&request.code_challenge,&request.state]).await.map_err(pg)?;
        commit(tx).await?;
        Ok(id)
    }
    /// Bind consent to the signed-in user before showing the requested destination.
    /// Re-used links cannot silently change the account approving them.
    pub async fn oauth_consent_in(
        &self,
        tx: &Transaction<'_>,
        session: &str,
        id: &str,
        resource: &str,
    ) -> Result<Consent> {
        if !valid_id(id) {
            return Err(Error::InvalidInput);
        }
        let user = self.authorize_transaction(tx, session).await?;
        let row = tx.query_opt("UPDATE aether_identity.oauth_requests r SET owner_id=$3 FROM aether_identity.oauth_clients c WHERE r.tenant=$1 AND r.id_hash=$2 AND r.resource=$4 AND r.expires>clock_timestamp() AND r.grant_id IS NULL AND (r.owner_id IS NULL OR r.owner_id=$3) AND c.tenant=r.tenant AND c.id=r.client_id RETURNING c.name,r.redirect_uri,r.resource", &[&self.tenant,&sha256(id.as_bytes()),&user.id,&resource]).await.map_err(pg)?.ok_or(Error::Forbidden)?;
        Ok(Consent {
            client_name: row.get(0),
            redirect_uri: row.get(1),
            resource: row.get(2),
        })
    }
    pub async fn complete_oauth_in(
        &self,
        tx: &Transaction<'_>,
        session: &str,
        id: &str,
        resource: &str,
        grant_id: Option<&str>,
    ) -> Result<String> {
        let consent = self.oauth_consent_in(tx, session, id, resource).await?;
        let hash = sha256(id.as_bytes());
        let row = tx.query_one("SELECT state,client_id FROM aether_identity.oauth_requests WHERE tenant=$1 AND id_hash=$2", &[&self.tenant,&hash]).await.map_err(pg)?;
        let state: String = row.get(0);
        if let Some(grant) = grant_id {
            let code = random_hex::<32>()?;
            tx.execute("UPDATE aether_identity.oauth_requests SET grant_id=$3,code_hash=$4,code_expires=clock_timestamp()+interval '2 minutes' WHERE tenant=$1 AND id_hash=$2", &[&self.tenant,&hash,&grant,&sha256(code.as_bytes())]).await.map_err(pg)?;
            tx.execute("INSERT INTO aether_identity.oauth_grants(tenant,grant_id,client_id,resource) VALUES($1,$2,$3,$4)", &[&self.tenant,&grant,&row.get::<_,String>(1),&resource]).await.map_err(pg)?;
            callback(&consent.redirect_uri, &state, Some(&code))
        } else {
            tx.execute(
                "DELETE FROM aether_identity.oauth_requests WHERE tenant=$1 AND id_hash=$2",
                &[&self.tenant, &hash],
            )
            .await
            .map_err(pg)?;
            callback(&consent.redirect_uri, &state, None)
        }
    }
    pub async fn exchange_oauth(&self, input: &Exchange, resource: &str) -> Result<(Secret, i64)> {
        if input.grant_type != "authorization_code"
            || input.resource != resource
            || !valid_id(&input.code)
            || !valid_id(&input.client_id)
            || !(43..=128).contains(&input.code_verifier.len())
            || !input
                .code_verifier
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"-._~".contains(&b))
        {
            return Err(Error::Unauthorized);
        }
        let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(input.code_verifier.as_bytes()));
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(pg)?;
        self.lock(&tx).await?;
        let row = tx.query_opt("SELECT r.grant_id, floor(extract(epoch FROM g.expires-clock_timestamp()))::bigint FROM aether_identity.oauth_requests r JOIN aether_identity.agent_connections g ON g.tenant=r.tenant AND g.id=r.grant_id JOIN aether_identity.users u ON u.tenant=g.tenant AND u.id=g.user_id WHERE r.tenant=$1 AND r.code_hash=$2 AND r.client_id=$3 AND r.redirect_uri=$4 AND r.resource=$5 AND r.challenge=$6 AND r.code_expires>clock_timestamp() AND g.expires>clock_timestamp() AND NOT g.revoked AND u.active AND NOT u.must_change", &[&self.tenant,&sha256(input.code.as_bytes()),&input.client_id,&input.redirect_uri,&resource,&challenge]).await.map_err(pg)?.ok_or(Error::Unauthorized)?;
        let grant: String = row.get(0);
        let token = Secret(Zeroizing::new(format!(
            "aether_mcp_{}",
            random_hex::<32>()?
        )));
        tx.execute(
            "UPDATE aether_identity.agent_connections SET token_hash=$3 WHERE tenant=$1 AND id=$2",
            &[&self.tenant, &grant, &sha256(token.expose().as_bytes())],
        )
        .await
        .map_err(pg)?;
        tx.execute(
            "DELETE FROM aether_identity.oauth_requests WHERE tenant=$1 AND grant_id=$2",
            &[&self.tenant, &grant],
        )
        .await
        .map_err(pg)?;
        commit(tx).await?;
        Ok((token, row.get(1)))
    }
    pub async fn authorize_mcp(&self, token: &str, resource: &str) -> Result<()> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(pg)?;
        let (_, grant) = self
            .authorize_agent_transaction(&tx, token, None, automation::AgentAccess::Read)
            .await?;
        if token.starts_with("aether_mcp_") && tx.query_opt("SELECT 1 FROM aether_identity.oauth_grants WHERE tenant=$1 AND grant_id=$2 AND resource=$3", &[&self.tenant,&grant.id,&resource]).await.map_err(pg)?.is_none() { return Err(Error::Unauthorized); }
        commit(tx).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn redirects_are_exact_safe_endpoints() {
        for s in [
            "https://client.example/callback",
            "http://127.0.0.1:4321/cb",
            "http://[::1]:8123/",
        ] {
            assert!(valid_redirect(s), "{s}");
        }
        for s in [
            "javascript:alert(1)",
            "https://user:secret@client.test/",
            "https://client.test/#code",
            "http://remote.test/cb",
            "https://client.test/cb?code=forged",
            "https://client.test/cb?state=forged",
        ] {
            assert!(!valid_redirect(s), "{s}");
        }
        assert_eq!(
            callback("https://client.test/cb?existing=1", "a&b", Some("123")).unwrap(),
            "https://client.test/cb?existing=1&code=123&state=a%26b"
        );
    }
}
