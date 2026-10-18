//! Bounded, read-only SSE invalidations. Reconnect always rechecks durable state.
use super::{
    NativeHost,
    boundary::{Failure, Result, token},
};
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response, Sse, sse::Event},
};
use futures_util::stream;
use serde::Deserialize;
use std::{convert::Infallible, time::Duration};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Request {
    app: String,
    id: String,
}

pub(super) async fn changes(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Query(request): Query<Request>,
) -> Result<Response> {
    let session = token(&headers)?;
    let docs = host.documents.clone().ok_or_else(|| {
        Failure::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "unavailable",
            "Document service unavailable.",
        )
    })?;
    if let Some(value) = headers.get("last-event-id") {
        let value = value.to_str().map_err(|_| {
            Failure::new(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "Invalid change token.",
            )
        })?;
        if !value
            .strip_prefix("state-")
            .is_some_and(|v| v.len() == 64 && v.bytes().all(|b| b.is_ascii_hexdigit()))
        {
            return Err(Failure::new(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "Invalid change token.",
            ));
        }
    }
    let permit = host
        .change_streams
        .clone()
        .try_acquire_owned()
        .map_err(|_| {
            Failure::new(
                StatusCode::TOO_MANY_REQUESTS,
                "stream_limit",
                "Too many document subscriptions.",
            )
        })?;
    let work = host
        .change_reads
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| {
            Failure::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "unavailable",
                "Document service unavailable.",
            )
        })?;
    // Register before reading state: a commit between that read and the first
    // SSE poll leaves a pending invalidation, never a lost update.
    let revision = host
        .revision_signals
        .as_ref()
        .map(|signals| signals.subscribe(host.identity.tenant(), &request.id));
    let initial = docs
        .change_state(&session, &request.app, &request.id)
        .await?;
    drop(work);
    // A slow reader creates no queue: unfold performs one check only when polled.
    // Each event is a fresh authorized snapshot or a heartbeat, never content.
    let events = stream::unfold(
        (
            host,
            docs,
            session,
            request,
            Some(initial),
            String::new(),
            Some(permit),
            revision,
        ),
        |(host, docs, session, request, mut initial, mut previous, mut permit, mut revision)| async move {
            permit.as_ref()?;
            let result = if let Some(state) = initial.take() {
                Ok(state)
            } else {
                let heartbeat = tokio::time::sleep(Duration::from_secs(1));
                if let Some(revision) = &mut revision {
                    tokio::select! { _ = heartbeat => {}, _ = revision.changed() => {} }
                } else {
                    heartbeat.await;
                }
                let check = async {
                    let _work = host
                        .change_reads
                        .acquire()
                        .await
                        .map_err(|_| crate::documents::Error::Unavailable)?;
                    docs.change_state(&session, &request.app, &request.id).await
                };
                tokio::time::timeout(Duration::from_secs(5), check)
                    .await
                    .unwrap_or(Err(crate::documents::Error::Unavailable))
            };
            let event = match result {
                Ok(state) => {
                    if state.state_token == previous {
                        Event::default().comment("authorized")
                    } else {
                        previous = state.state_token.clone();
                        Event::default()
                            .event("state")
                            .id(&previous)
                            .json_data(state)
                            .expect("serializable change state")
                    }
                }
                Err(_) => {
                    // No stale state or reason/identifier is disclosed after loss
                    // of authority. The client stops and rechecks its connection.
                    permit.take();
                    Event::default()
                        .event("unavailable")
                        .data("{\"reconnect\":true}")
                }
            };
            Some((
                Ok::<_, Infallible>(event),
                (
                    host, docs, session, request, initial, previous, permit, revision,
                ),
            ))
        },
    );
    let mut response = Sse::new(events).into_response();
    response
        .headers_mut()
        .insert("x-accel-buffering", "no".parse().expect("static header"));
    Ok(response)
}
