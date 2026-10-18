use super::*;
async fn search(f: &Fixture, user: Option<&str>, query: &str) -> reqwest::Response {
    let mut request = f
        .client
        .get(format!("{}/api/map/assets/search", f.url))
        .query(&[("q", query)]);
    if let Some(user) = user {
        request = request.header("cookie", format!("{COOKIE}={}", token(user)));
    }
    request.send().await.unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn search_requires_current_map_access_even_for_empty_queries() {
    let f = Fixture::new().await;
    assert_eq!(search(&f, None, "").await.status(), 401);
    let response = search(&f, Some("alice"), "  ").await;
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert_eq!(
        response.json::<Value>().await.unwrap(),
        json!({"results":[],"result_count":0,"page":1,"page_count":0})
    );
    assert_eq!(
        search(&f, Some("alice"), &"x".repeat(513)).await.status(),
        400
    );
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='alice'")
        .await;
    assert_eq!(search(&f, Some("alice"), "").await.status(), 403);
    f.sql("UPDATE aether_identity.users SET must_change=false WHERE id='alice'; UPDATE aether_access.applications SET enabled=false WHERE id='map'").await;
    assert_eq!(search(&f, Some("alice"), "").await.status(), 403);
    assert_eq!(search(&f, Some("admin"), "").await.status(), 403);
    f.sql("UPDATE aether_access.applications SET enabled=true WHERE id='map'; DELETE FROM aether_identity.sessions WHERE user_id='alice'").await;
    assert_eq!(search(&f, Some("alice"), "").await.status(), 401);
}
