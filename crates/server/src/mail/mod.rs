//! Native SMTP delivery. Private credentials are outside SQL/content backups;
//! configuration and redacted activity remain Studio-owned PostgreSQL records.
mod vault;
use crate::settings::{Error, Result, Settings};
use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    transport::smtp::authentication::Credentials,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{future::Future, pin::Pin, sync::Arc, time::Duration};
use tokio::sync::Semaphore;
pub use vault::Vault;
use zeroize::Zeroizing;
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Configuration {
    pub enabled: bool,
    pub host: String,
    pub port: u16,
    pub security: String,
    pub username: String,
    pub sender: String,
    pub(crate) secret_id: String,
}
impl Default for Configuration {
    fn default() -> Self {
        Self {
            enabled: false,
            host: String::new(),
            port: 587,
            security: "starttls".into(),
            username: String::new(),
            sender: String::new(),
            secret_id: String::new(),
        }
    }
}
impl Configuration {
    pub fn public(&self) -> Value {
        json!({"enabled":self.enabled,"host":self.host,"port":self.port,"security":self.security,"username":self.username,"sender":self.sender,"password_set":!self.secret_id.is_empty()})
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Change {
    pub enabled: bool,
    pub host: String,
    pub port: u16,
    pub security: String,
    pub username: String,
    pub sender: String,
    #[serde(default)]
    pub password: Zeroizing<String>,
}
impl Change {
    pub fn validate(&self) -> Result<()> {
        if self.port == 0
            || !matches!(self.security.as_str(), "tls" | "starttls")
            || self.host.len() > 253
            || self.username.len() > 320
            || self.password.len() > 4096
            || self.sender.len() > 254
            || self
                .host
                .chars()
                .any(|c| c.is_whitespace() || c.is_control() || "/@?#\\".contains(c))
            || self.username.chars().any(char::is_control)
            || self.sender.chars().any(char::is_control)
            || (self.enabled
                && (self.host.is_empty() || self.sender.parse::<lettre::Address>().is_err()))
        {
            return Err(Error::Invalid);
        }
        Ok(())
    }
    pub fn configuration(&self) -> Configuration {
        Configuration {
            enabled: self.enabled,
            host: self.host.clone(),
            port: self.port,
            security: self.security.clone(),
            username: self.username.clone(),
            sender: self.sender.clone(),
            secret_id: String::new(),
        }
    }
}
/// Operator-supplied transport boundary. Production uses verified TLS SMTP;
/// tests can observe messages without sending email to external recipients.
pub trait Delivery: Send + Sync {
    fn send<'a>(
        &'a self,
        config: &'a Configuration,
        password: Zeroizing<String>,
        message: Message,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + 'a>>;
}
pub struct Smtp;
impl Delivery for Smtp {
    fn send<'a>(
        &'a self,
        c: &'a Configuration,
        password: Zeroizing<String>,
        message: Message,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + 'a>> {
        Box::pin(async move {
            let builder = match c.security.as_str() {
                "tls" => AsyncSmtpTransport::<Tokio1Executor>::relay(&c.host),
                "starttls" => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&c.host),
                _ => return Err(Error::Invalid),
            }
            .map_err(|_| Error::Invalid)?
            .port(c.port)
            .timeout(Some(Duration::from_secs(10)));
            let builder = if c.username.is_empty() {
                builder
            } else {
                builder.credentials(Credentials::new(c.username.clone(), password.to_string()))
            };
            builder
                .build()
                .send(message)
                .await
                .map_err(|_| Error::Unavailable)?;
            Ok(())
        })
    }
}
#[derive(Clone)]
pub struct Mail {
    pub settings: Settings,
    pub vault: Vault,
    delivery: Arc<dyn Delivery>,
    slots: Arc<Semaphore>,
}
impl Mail {
    pub fn new(settings: Settings, vault: Vault) -> Self {
        Self::with_delivery(settings, vault, Arc::new(Smtp))
    }
    pub fn with_delivery(settings: Settings, vault: Vault, delivery: Arc<dyn Delivery>) -> Self {
        Self {
            settings,
            vault,
            delivery,
            slots: Arc::new(Semaphore::new(16)),
        }
    }
    pub async fn available(&self) -> Result<bool> {
        let c = self.settings.mail_snapshot().await?;
        Ok(c.enabled && (c.secret_id.is_empty() || self.vault.get(&c.secret_id).await.is_ok()))
    }
    pub async fn recovery(
        &self,
        identity: aether_identity::Identity,
        account: String,
        peer: String,
        origin: String,
    ) -> Result<()> {
        // Every account gets the same queued response, including unknown accounts.
        let permit = self
            .slots
            .clone()
            .try_acquire_owned()
            .map_err(|_| Error::Unavailable)?;
        let this = self.clone();
        tokio::spawn(async move {
            let _permit = permit;
            let result=async {
                if !this.available().await? {return Ok(());}
                if let Some(token)=identity.request_recovery(&account,&peer).await?
                    && let Some(recipient)=identity.recovery_delivery(token.expose()).await? {
                        let text=Zeroizing::new(format!("Your Aether Studio username is {}.\n\nChoose a new password within 30 minutes:\n{}/#reset={}\n\nThis link works once. If you did not request it, you can ignore this email.\n",recipient.username,origin,token.expose()));
                        let sent=this.send(&recipient.email,"Aether Studio account recovery",text).await;
                        this.settings.mail_event(&recipient.id,if sent.is_ok(){"recovery_sent"}else{"recovery_failed"}).await?;
                }
                Ok::<(),Error>(())
            }.await;
            if result.is_err() {
                let _ = this.settings.mail_event("", "recovery_failed").await;
            }
        });
        Ok(())
    }
    pub async fn test(
        &self,
        identity: aether_identity::Identity,
        token: Zeroizing<String>,
    ) -> Result<()> {
        self.settings.mail_read(&token).await?;
        if !self.available().await? {
            return Err(Error::Invalid);
        }
        let permit = self
            .slots
            .clone()
            .try_acquire_owned()
            .map_err(|_| Error::Unavailable)?;
        let this = self.clone();
        tokio::spawn(async move {
            let _permit = permit;
            let result = async {
                this.settings.mail_read(&token).await?;
                let user = identity.authenticate(&token).await?;
                let sent = this
                    .send(
                        &user.email,
                        "Aether Studio delivery test",
                        Zeroizing::new(
                            "Email delivery from your Aether Studio server is working.".into(),
                        ),
                    )
                    .await;
                this.settings
                    .mail_event(
                        &user.id,
                        if sent.is_ok() {
                            "mail_test_sent"
                        } else {
                            "mail_test_failed"
                        },
                    )
                    .await
            }
            .await;
            if result.is_err() {
                let _ = this.settings.mail_event("", "mail_test_failed").await;
            }
        });
        Ok(())
    }
    pub async fn password_changed(&self, recipient: aether_identity::RecoveryDelivery) {
        let Ok(permit) = self.slots.clone().try_acquire_owned() else {
            let _ = self
                .settings
                .mail_event(&recipient.id, "password_notice_failed")
                .await;
            return;
        };
        let this = self.clone();
        tokio::spawn(async move {
            let _permit = permit;
            let sent=this.send(&recipient.email,"Your Aether Studio password changed",Zeroizing::new("Your password was changed using a recovery link. All existing sign-ins have been revoked. If this was not you, contact your server administrator.".into())).await;
            let _ = this
                .settings
                .mail_event(
                    &recipient.id,
                    if sent.is_ok() {
                        "password_notice_sent"
                    } else {
                        "password_notice_failed"
                    },
                )
                .await;
        });
    }
    async fn send(&self, recipient: &str, subject: &str, text: Zeroizing<String>) -> Result<()> {
        let config = self.settings.mail_snapshot().await?;
        if !config.enabled {
            return Err(Error::Invalid);
        }
        let password = if config.secret_id.is_empty() {
            Zeroizing::new(String::new())
        } else {
            self.vault.get(&config.secret_id).await?
        };
        let message = Message::builder()
            .from(config.sender.parse().map_err(|_| Error::Invalid)?)
            .to(recipient.parse().map_err(|_| Error::Invalid)?)
            .subject(subject)
            .body(text.to_string())
            .map_err(|_| Error::Invalid)?;
        tokio::time::timeout(
            Duration::from_secs(15),
            self.delivery.send(&config, password, message),
        )
        .await
        .map_err(|_| Error::Unavailable)?
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    #[tokio::test]
    async fn smtp_refuses_starttls_downgrade_before_credentials_or_message() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let (read, mut write) = stream.into_split();
            let mut read = BufReader::new(read);
            let mut transcript = String::new();
            write.write_all(b"220 local-test ESMTP\r\n").await.unwrap();
            read.read_line(&mut transcript).await.unwrap();
            assert!(transcript.starts_with("EHLO "));
            write
                .write_all(b"250-local-test\r\n250 AUTH PLAIN LOGIN\r\n")
                .await
                .unwrap();
            let mut line = String::new();
            if let Ok(Ok(_)) =
                tokio::time::timeout(Duration::from_secs(2), read.read_line(&mut line)).await
            {
                transcript.push_str(&line);
            }
            transcript
        });
        let c = Configuration {
            enabled: true,
            host: "127.0.0.1".into(),
            port,
            username: "private-user".into(),
            sender: "sender@example.test".into(),
            ..Configuration::default()
        };
        let msg = Message::builder()
            .from("sender@example.test".parse().unwrap())
            .to("receiver@example.test".parse().unwrap())
            .subject("Private")
            .body("never transmit plaintext".to_string())
            .unwrap();
        assert!(
            Smtp.send(&c, Zeroizing::new("private-password".into()), msg)
                .await
                .is_err()
        );
        let seen = server.await.unwrap();
        assert!(!seen.contains("AUTH"));
        assert!(!seen.contains("DATA"));
        assert!(!seen.contains("private-password"));
    }
    #[tokio::test]
    async fn secret_vault_is_private_bounded_and_cannot_follow_secret_symlinks() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("vault");
        let v = Vault::open(&path, "tenant").unwrap();
        let id = v.put("credential").await.unwrap();
        assert_eq!(v.get(&id).await.unwrap().as_str(), "credential");
        assert!(v.get("../../outside").await.is_err());
        assert!(v.put(&"x".repeat(4097)).await.is_err());
        #[cfg(unix)]
        {
            use sha2::{Digest, Sha256};
            use std::os::unix::fs::{PermissionsExt, symlink};
            let file = path
                .join(format!("{:x}", Sha256::digest("tenant")))
                .join(&id);
            std::fs::remove_file(&file).unwrap();
            let outside = root.path().join("outside");
            std::fs::write(&outside, "outside-secret").unwrap();
            symlink(&outside, &file).unwrap();
            assert!(v.get(&id).await.is_err());
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
            assert!(Vault::open(&path, "tenant").is_err());
        }
    }
}
