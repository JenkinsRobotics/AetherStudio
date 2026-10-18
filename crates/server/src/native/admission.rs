//! Short, bounded startup bursts may wait without increasing heavy-operation concurrency.
use super::NativeHost;
use std::time::{Duration, Instant};
use tokio::sync::OwnedSemaphorePermit;

pub(super) struct Permit {
    _slot: Option<OwnedSemaphorePermit>,
    _execution: OwnedSemaphorePermit,
    pub remaining: Duration,
}

// Slow media senders have their own capacity and cannot occupy editing slots.
pub(super) fn acquire_media_upload(host: &NativeHost) -> Result<Permit, ()> {
    Ok(Permit {
        _slot: None,
        _execution: host
            .media_uploads
            .clone()
            .try_acquire_owned()
            .map_err(|_| ())?,
        remaining: Duration::from_secs(600),
    })
}

pub(super) async fn acquire(host: &NativeHost, path: &str) -> Result<Permit, ()> {
    if path == "/api/map/assets/search" {
        return Ok(Permit {
            _slot: None,
            _execution: host
                .map_searches
                .clone()
                .try_acquire_owned()
                .map_err(|_| ())?,
            remaining: host.deadline.min(Duration::from_secs(20)),
        });
    }
    let started = Instant::now();
    let document = path == "/mcp"
        || path.starts_with("/api/automation/")
        || path.starts_with("/api/v1/documents/")
        || path.starts_with("/api/library/")
        || path.starts_with("/api/drive/")
        || path.starts_with("/api/cad/")
        || path.starts_with("/api/map/")
        || path == "/api/preferences"
        || path == "/animation/rpc"
        || path == "/cad/rpc"
        || path.ends_with("/files/save")
        || path.contains("/workspace/");
    let (slot, execution) = if document {
        // At most20 admitted requests, with4 regular and4 metadata handlers.
        // Small history/discussion reads must not wait for geometry workers.
        // Bodies and
        // authentication/SQL handlers are not polled until execution is admitted.
        // Dropping/cancelling any future releases both capacity reservations.
        let slot = host
            .document_slots
            .clone()
            .try_acquire_owned()
            .map_err(|_| ())?;
        let execution_pool =
            if matches!(path, "/api/library/collaboration" | "/api/library/history") {
                &host.document_metadata
            } else {
                &host.document_admission
            };
        let execution = tokio::time::timeout(
            // A durable storage commit can exceed250ms on an otherwise healthy
            // local host. Keep the20-request/4-handler bounds, but allow a
            // cold CAD startup may also take more than one second. Retain the
            // same capacity bounds with a two-second queue inside that deadline.
            host.deadline.min(Duration::from_secs(2)),
            execution_pool.clone().acquire_owned(),
        )
        .await
        .map_err(|_| ())?
        .map_err(|_| ())?;
        (Some(slot), execution)
    } else {
        // Document queues cannot consume the separate account/control capacity.
        (
            None,
            host.admission.clone().try_acquire_owned().map_err(|_| ())?,
        )
    };
    let remaining = host.deadline.saturating_sub(started.elapsed());
    if remaining.is_zero() {
        return Err(());
    }
    Ok(Permit {
        _slot: slot,
        _execution: execution,
        remaining,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use aether_identity::Identity;
    use deadpool_postgres::{Manager, Pool};
    use tokio_postgres::NoTls;

    fn host(deadline: Duration) -> NativeHost {
        let pool = Pool::builder(Manager::new(
            "host=/tmp/aether-no-database".parse().unwrap(),
            NoTls,
        ))
        .max_size(1)
        .build()
        .unwrap();
        NativeHost::new(
            Identity::new(pool, "fixture", 1).unwrap(),
            "http://127.0.0.1:8880",
            1,
            deadline,
        )
        .unwrap()
    }
    #[tokio::test]
    async fn external_searches_are_bounded_without_blocking_edits_or_accounts() {
        let h = host(Duration::from_secs(30));
        let first = acquire(&h, "/api/map/assets/search").await.unwrap();
        let second = acquire(&h, "/api/map/assets/search").await.unwrap();
        assert!(acquire(&h, "/api/map/assets/search").await.is_err());
        assert!(acquire(&h, "/api/library/read").await.is_ok());
        assert!(acquire(&h, "/api/status").await.is_ok());
        assert_eq!(first.remaining, Duration::from_secs(20));
        drop(second);
        assert!(acquire(&h, "/api/map/assets/search").await.is_ok());
    }
    #[tokio::test]
    async fn slow_media_uploads_do_not_consume_editing_slots() {
        let host = host(Duration::from_secs(1));
        let first = acquire_media_upload(&host).unwrap();
        let second = acquire_media_upload(&host).unwrap();
        assert!(acquire_media_upload(&host).is_err());
        assert!(acquire(&host, "/api/library/read").await.is_ok());
        assert_eq!(first.remaining, Duration::from_secs(600));
        drop(second);
        assert!(acquire_media_upload(&host).is_ok());
    }
    async fn queued(host: &NativeHost) {
        tokio::time::timeout(Duration::from_secs(1), async {
            while host.document_slots.available_permits() != 19 {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
    }
    #[tokio::test]
    async fn document_burst_waits_then_runs_without_blocking_account_control() {
        let h = host(Duration::from_secs(1));
        let active = h
            .document_admission
            .clone()
            .acquire_many_owned(4)
            .await
            .unwrap();
        let copy = h.clone();
        let task = tokio::spawn(async move { acquire(&copy, "/api/library/list").await });
        queued(&h).await;
        assert!(!task.is_finished());
        let account = acquire(&h, "/api/logout").await.unwrap();
        drop(account);
        drop(active);
        let admitted = task.await.unwrap().unwrap();
        assert_eq!(h.document_admission.available_permits(), 3);
        assert!(admitted.remaining <= h.deadline);
        drop(admitted);
        assert_eq!(h.document_admission.available_permits(), 4);
        assert_eq!(h.document_slots.available_permits(), 20);
    }
    #[tokio::test]
    async fn durable_commit_burst_can_wait_beyond_250ms() {
        let h = host(Duration::from_secs(2));
        let active = h
            .document_admission
            .clone()
            .acquire_many_owned(4)
            .await
            .unwrap();
        let copy = h.clone();
        let task = tokio::spawn(async move { acquire(&copy, "/api/library/save").await });
        queued(&h).await;
        tokio::time::sleep(Duration::from_millis(300)).await;
        assert!(!task.is_finished());
        // Account requests still bypass the document queue.
        drop(acquire(&h, "/api/logout").await.unwrap());
        drop(active);
        let permit = task.await.unwrap().unwrap();
        assert!(permit.remaining < Duration::from_millis(1750));
        drop(permit);
        assert_eq!(h.document_slots.available_permits(), 20);
        assert_eq!(h.document_admission.available_permits(), 4);
    }
    #[tokio::test]
    async fn cold_editor_listing_waits_for_a_startup_longer_than_one_second() {
        let h = host(Duration::from_secs(3));
        let active = h
            .document_admission
            .clone()
            .acquire_many_owned(4)
            .await
            .unwrap();
        let copy = h.clone();
        let task = tokio::spawn(async move { acquire(&copy, "/api/library/list").await });
        queued(&h).await;
        tokio::time::sleep(Duration::from_millis(1150)).await;
        assert!(!task.is_finished());
        assert!(acquire(&h, "/api/logout").await.is_ok());
        drop(active);
        let admitted = task.await.unwrap().unwrap();
        assert!(admitted.remaining < Duration::from_secs(2));
        drop(admitted);
        assert_eq!(h.document_slots.available_permits(), 20);
        assert_eq!(h.document_admission.available_permits(), 4);
    }
    #[tokio::test]
    async fn history_and_discussions_remain_available_during_geometry_work() {
        let h = host(Duration::from_secs(3));
        let active = h
            .document_admission
            .clone()
            .acquire_many_owned(4)
            .await
            .unwrap();
        let history = acquire(&h, "/api/library/history").await.unwrap();
        let discussion = acquire(&h, "/api/library/collaboration").await.unwrap();
        assert_eq!(h.document_admission.available_permits(), 0);
        assert_eq!(h.document_metadata.available_permits(), 2);
        assert_eq!(h.document_slots.available_permits(), 18);
        assert!(acquire(&h, "/api/logout").await.is_ok());
        drop((active, history, discussion));
        assert_eq!(h.document_slots.available_permits(), 20);
        assert_eq!(h.document_metadata.available_permits(), 4);
    }
    #[tokio::test]
    async fn queue_capacity_and_deadline_refuse_without_entering_handler() {
        let h = host(Duration::from_millis(25));
        let slots = h
            .document_slots
            .clone()
            .acquire_many_owned(20)
            .await
            .unwrap();
        assert!(acquire(&h, "/api/library/save").await.is_err());
        drop(slots);
        let active = h
            .document_admission
            .clone()
            .acquire_many_owned(4)
            .await
            .unwrap();
        assert!(acquire(&h, "/api/library/save").await.is_err());
        assert_eq!(h.document_slots.available_permits(), 20);
        assert_eq!(h.document_admission.available_permits(), 0);
        drop(active);
        assert!(acquire(&h, "/api/library/save").await.is_ok());
    }
    #[tokio::test]
    async fn workspace_and_animation_work_cannot_exhaust_account_slots() {
        let h = host(Duration::from_secs(1));
        let paths = [
            "/animation/rpc",
            "/animation/files/save",
            "/map/workspace/a",
            "/cad/files/save",
        ];
        let mut permits = Vec::new();
        for path in paths {
            permits.push(acquire(&h, path).await.unwrap());
        }
        assert_eq!(h.document_admission.available_permits(), 0);
        assert!(acquire(&h, "/api/logout").await.is_ok());
        drop(permits);
        assert_eq!(h.document_admission.available_permits(), 4);
    }
    #[tokio::test]
    async fn cancelling_a_waiter_releases_capacity_without_running_it() {
        let h = host(Duration::from_secs(1));
        let active = h
            .document_admission
            .clone()
            .acquire_many_owned(4)
            .await
            .unwrap();
        let copy = h.clone();
        let task = tokio::spawn(async move { acquire(&copy, "/api/v1/documents/mutate").await });
        queued(&h).await;
        task.abort();
        assert!(task.await.is_err());
        assert_eq!(h.document_slots.available_permits(), 20);
        assert_eq!(h.document_admission.available_permits(), 0);
        drop(active);
    }
}
