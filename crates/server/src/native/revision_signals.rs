//! Optional acceleration for durable revision snapshots, not a second event log.
//! One dedicated local PostgreSQL connection per host. No transaction is held
//! while listening. Lost hints are recovered by the authorized SSE poll/reconnect.
use futures_util::future::poll_fn;
use std::{
    collections::HashMap,
    future::pending,
    sync::{Arc, Mutex, Weak},
    time::Duration,
};
use tokio::sync::{oneshot, watch};
use tokio_postgres::{AsyncMessage, Config, NoTls};

#[derive(Clone)]
pub struct RevisionSignals {
    inner: Arc<Inner>,
    _task: Arc<ListenerTask>,
}

struct ListenerTask(tokio::task::JoinHandle<()>);
impl Drop for ListenerTask {
    fn drop(&mut self) {
        self.0.abort();
    }
}

#[derive(Default)]
struct Inner {
    // Weak entries never retain a departed document. Each active SSE subscription
    // owns its sender; the native stream admission bound also bounds this map.
    documents: Mutex<HashMap<String, Weak<watch::Sender<()>>>>,
}

pub(super) struct Subscription {
    _sender: Arc<watch::Sender<()>>,
    receiver: watch::Receiver<()>,
}
impl Subscription {
    pub(super) async fn changed(&mut self) {
        if self.receiver.changed().await.is_err() {
            // A closed signal must never turn the authorization loop into a spin.
            pending::<()>().await;
        }
    }
}

impl RevisionSignals {
    pub async fn connect_local(mut config: Config) -> Result<Self, String> {
        super::configuration::validate_local(&config)?;
        config.application_name("aether-revision-listener");
        let inner = Arc::new(Inner::default());
        let (ready, received) = oneshot::channel();
        let task = Arc::new(ListenerTask(tokio::spawn(listen(
            config,
            inner.clone(),
            Some(ready),
        ))));
        // LISTEN must be committed before the first subscriber's snapshot.
        // A failure drops the task guard, including its connection and secrets.
        tokio::time::timeout(Duration::from_secs(6), received)
            .await
            .map_err(|_| "Document notification listener unavailable.")?
            .map_err(|_| "Document notification listener unavailable.")?;
        Ok(Self { inner, _task: task })
    }

    pub(super) fn subscribe(&self, tenant: &str, document: &str) -> Subscription {
        self.inner
            .subscribe(aether_store::hosted::revision_signal_key(tenant, document))
    }
}

impl Inner {
    fn subscribe(&self, key: String) -> Subscription {
        let mut documents = self.documents.lock().expect("notification registry");
        documents.retain(|_, sender| sender.strong_count() > 0);
        let sender = documents
            .get(&key)
            .and_then(Weak::upgrade)
            .unwrap_or_else(|| {
                let (sender, _) = watch::channel(());
                let sender = Arc::new(sender);
                documents.insert(key, Arc::downgrade(&sender));
                sender
            });
        Subscription {
            receiver: sender.subscribe(),
            _sender: sender,
        }
    }

    fn signal(&self, key: &str) {
        if key.len() != 64 || !key.bytes().all(|b| b.is_ascii_hexdigit()) {
            return;
        }
        let documents = self.documents.lock().expect("notification registry");
        if let Some(sender) = documents.get(key).and_then(Weak::upgrade) {
            // watch coalesces an arbitrary burst to one unread invalidation.
            let _ = sender.send(());
        }
    }

    fn reconnected(&self) {
        let mut documents = self.documents.lock().expect("notification registry");
        documents.retain(|_, sender| {
            if let Some(sender) = sender.upgrade() {
                let _ = sender.send(());
                true
            } else {
                false
            }
        });
    }
}

async fn listen(config: Config, inner: Arc<Inner>, mut ready: Option<oneshot::Sender<()>>) {
    loop {
        if let Ok(Ok((client, mut connection))) =
            tokio::time::timeout(Duration::from_secs(5), config.connect(NoTls)).await
        {
            let messages = async {
                while let Some(Ok(message)) = poll_fn(|cx| connection.poll_message(cx)).await {
                    if let AsyncMessage::Notification(message) = message
                        && message.channel() == "aether_revision_v1"
                    {
                        inner.signal(message.payload());
                    }
                }
            };
            let commands = async {
                if client
                    .batch_execute("LISTEN aether_revision_v1")
                    .await
                    .is_ok()
                {
                    inner.reconnected();
                    if let Some(ready) = ready.take() {
                        let _ = ready.send(());
                    }
                    pending::<()>().await;
                }
            };
            tokio::select! { _ = messages => {}, _ = commands => {} }
        }
        // No credentials, database diagnostics or identifiers go to user output.
        // The ordinary SSE authorization heartbeat continues during reconnect.
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn hints_are_scoped_coalesced_and_do_not_retain_departed_subscribers() {
        let inner = Inner::default();
        let key = aether_store::hosted::revision_signal_key("one", "document");
        let other_key = aether_store::hosted::revision_signal_key("two", "document");
        let mut a = inner.subscribe(key.clone());
        let mut b = inner.subscribe(key.clone());
        let other = inner.subscribe(other_key);
        for _ in 0..10000 {
            inner.signal(&key);
        }
        a.changed().await;
        b.changed().await;
        assert!(!a.receiver.has_changed().unwrap());
        assert!(!b.receiver.has_changed().unwrap());
        assert!(!other.receiver.has_changed().unwrap());
        inner.signal("malformed");
        assert!(!a.receiver.has_changed().unwrap());
        drop(a);
        drop(b);
        inner.reconnected();
        assert_eq!(inner.documents.lock().unwrap().len(), 1);
        drop(other);
        inner.reconnected();
        assert!(inner.documents.lock().unwrap().is_empty());
        assert_ne!(
            aether_store::hosted::revision_signal_key("ab", "c"),
            aether_store::hosted::revision_signal_key("a", "bc")
        );
    }
}
