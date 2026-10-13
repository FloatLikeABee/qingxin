use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use qingxin_api::moderation::{Decision, ModerationError, Moderator};
use qingxin_api::{app, AppState, Config};
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt;

async fn world() -> (axum::Router, AppState) {
    let state = AppState::connect(Config::test())
        .await
        .expect("connect test db");
    (app(state.clone()), state)
}

async fn send(
    router: &axum::Router,
    method: Method,
    uri: &str,
    auth: Option<(&str, &str)>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some((scheme, token)) = auth {
        builder = builder.header(header::AUTHORIZATION, format!("{scheme} {token}"));
    }
    let request = if let Some(json) = body {
        builder
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&json).unwrap()))
            .unwrap()
    } else {
        builder.body(Body::empty()).unwrap()
    };
    let response = router.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
        .await
        .unwrap();
    if bytes.is_empty() {
        return (status, Value::Null);
    }
    let json = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()));
    (status, json)
}

fn register_body(email: &str) -> Value {
    json!({
        "email": email,
        "password": "correct-horse",
        "display_name": "轻心同学",
        "consent": { "policy_version": "2026-10-13" }
    })
}

async fn register_user(router: &axum::Router, email: &str) -> Value {
    let (status, body) = send(
        router,
        Method::POST,
        "/v1/auth/register",
        None,
        Some(register_body(email)),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    body
}

fn items(body: &Value) -> &[Value] {
    body["items"].as_array().map(Vec::as_slice).unwrap_or(&[])
}

struct RejectModerator;

#[async_trait::async_trait]
impl Moderator for RejectModerator {
    async fn check(&self, _content: &str) -> Result<Decision, ModerationError> {
        Ok(Decision::Reject {
            reason: "blocked".into(),
        })
    }
}

#[test]
fn haversine_is_zero_at_the_same_point_and_grows_east() {
    let origin_lat = 31.230_416;
    let origin_lng = 121.473_701;
    assert!(
        (qingxin_api::local::haversine_m(origin_lat, origin_lng, origin_lat, origin_lng)).abs()
            < 0.5
    );
    let east =
        qingxin_api::local::haversine_m(origin_lat, origin_lng, origin_lat, origin_lng + 0.01);
    assert!(east > 900.0 && east < 1_100.0, "east meters {east}");
}

#[tokio::test]
async fn seed_catalog_requires_auth_and_rejects_unknown_category() {
    let (router, _) = world().await;
    let created = register_user(&router, "local-seed@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, denied) = send(&router, Method::GET, "/v1/local/services", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(denied["error"]["code"], "unauthenticated");

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/local/services",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    let names: Vec<&str> = items(&listed)
        .iter()
        .filter_map(|row| row["name"].as_str())
        .collect();
    assert!(
        names.iter().any(|name| name.contains("宠物医院")),
        "{names:?}"
    );
    assert!(items(&listed).iter().any(|row| row["category"] == "宠物"));

    let (status, bad) = send(
        &router,
        Method::POST,
        "/v1/local/services",
        Some(("Bearer", access)),
        Some(json!({
            "name": "夜店",
            "category": "酒吧",
            "address": "静安区",
            "latitude": 31.23,
            "longitude": 121.47
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{bad}");
    assert_eq!(bad["error"]["code"], "invalid_request");
}

#[tokio::test]
async fn search_sort_and_distance() {
    let (router, _) = world().await;
    let created = register_user(&router, "local-search@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, found) = send(
        &router,
        Method::GET,
        "/v1/local/services?q=%E5%AE%A0%E7%89%A9%E5%8C%BB%E9%99%A2",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{found}");
    let found_items = items(&found);
    assert!(!found_items.is_empty(), "{found}");
    assert!(found_items.iter().all(|row| row["name"]
        .as_str()
        .unwrap_or_default()
        .contains("宠物医院")));
    assert!(found_items[0]["distance_m"].as_f64().is_some());

    let (status, by_rating) = send(
        &router,
        Method::GET,
        "/v1/local/services?sort=rating",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{by_rating}");
    let ratings: Vec<f64> = items(&by_rating)
        .iter()
        .filter_map(|row| row["rating_avg"].as_f64())
        .collect();
    let mut sorted = ratings.clone();
    sorted.sort_by(|a, b| b.partial_cmp(a).unwrap());
    assert_eq!(ratings, sorted);

    let (status, by_distance) = send(
        &router,
        Method::GET,
        "/v1/local/services?sort=distance",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{by_distance}");
    let distances: Vec<f64> = items(&by_distance)
        .iter()
        .filter_map(|row| row["distance_m"].as_f64())
        .collect();
    let mut dsorted = distances.clone();
    dsorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    assert_eq!(distances, dsorted);

    let (status, ramp) = send(
        &router,
        Method::GET,
        "/v1/local/services?tag=%E6%9C%89%E5%9D%A1%E9%81%93",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{ramp}");
    let ramp_items = items(&ramp);
    assert!(!ramp_items.is_empty());
    assert!(ramp_items.iter().all(|row| {
        row["tags"]
            .as_array()
            .unwrap()
            .iter()
            .any(|tag| tag == "有坡道")
    }));

    let (status, bad_sort) = send(
        &router,
        Method::GET,
        "/v1/local/services?sort=popularity",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad_sort["error"]["code"], "invalid_request");
}

#[tokio::test]
async fn detail_reviews_and_corrections() {
    let (router, _) = world().await;
    let created = register_user(&router, "local-detail@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/local/services?q=%E5%AE%A0%E7%89%A9%E5%8C%BB%E9%99%A2",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    let id = items(&listed)[0]["id"].as_str().unwrap();

    let (status, detail) = send(
        &router,
        Method::GET,
        &format!("/v1/local/services/{id}"),
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{detail}");
    assert!(detail["hours"].as_str().unwrap().len() > 3);
    assert!(detail["phone"].as_str().unwrap().len() > 3);
    assert!(detail["address"].as_str().unwrap().contains("路"));

    let (status, missing) = send(
        &router,
        Method::GET,
        "/v1/local/services/00000000-0000-4000-8000-000000000099",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{missing}");

    let (status, review) = send(
        &router,
        Method::POST,
        &format!("/v1/local/services/{id}/reviews"),
        Some(("Bearer", access)),
        Some(json!({ "content": "医生很耐心", "rating": 5 })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{review}");
    assert_eq!(review["content"], "医生很耐心");

    let (status, reviews) = send(
        &router,
        Method::GET,
        &format!("/v1/local/services/{id}/reviews"),
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{reviews}");
    assert!(items(&reviews)
        .iter()
        .any(|row| row["content"] == "医生很耐心"));

    let (status, after) = send(
        &router,
        Method::GET,
        &format!("/v1/local/services/{id}"),
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{after}");
    assert!((after["rating_avg"].as_f64().unwrap() - 5.0).abs() < 0.01);

    let (status, too_long) = send(
        &router,
        Method::POST,
        &format!("/v1/local/services/{id}/reviews"),
        Some(("Bearer", access)),
        Some(json!({ "content": "字".repeat(501) })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{too_long}");
    assert_eq!(too_long["error"]["code"], "invalid_request");

    let (status, flag) = send(
        &router,
        Method::POST,
        &format!("/v1/local/services/{id}/corrections"),
        Some(("Bearer", access)),
        Some(json!({ "kind": "电话空号" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{flag}");

    let (status, flagged) = send(
        &router,
        Method::GET,
        &format!("/v1/local/services/{id}"),
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{flagged}");
    assert!(flagged["correction_counts"]["电话空号"].as_i64().unwrap() >= 1);

    let (status, bad_kind) = send(
        &router,
        Method::POST,
        &format!("/v1/local/services/{id}/corrections"),
        Some(("Bearer", access)),
        Some(json!({ "kind": "价格贵" })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(bad_kind["error"]["code"], "invalid_request");
}

#[tokio::test]
async fn publish_is_idempotent_and_lists() {
    let (router, _) = world().await;
    let created = register_user(&router, "local-publish@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();
    let id = "22222222-2222-4222-8222-222222222222";

    let payload = json!({
        "id": id,
        "name": "街角修伞铺",
        "category": "维修",
        "address": "轻心路 8 号",
        "latitude": 31.2298,
        "longitude": 121.4742,
        "hours": "10:00–19:00",
        "phone": "021-5555-0202",
        "tags": ["耐心服务"]
    });
    let (status, first) = send(
        &router,
        Method::POST,
        "/v1/local/services",
        Some(("Bearer", access)),
        Some(payload.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    assert_eq!(first["name"], "街角修伞铺");

    let (status, second) = send(
        &router,
        Method::POST,
        "/v1/local/services",
        Some(("Bearer", access)),
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{second}");
    assert_eq!(second["id"], first["id"]);

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/local/services?q=%E4%BF%AE%E4%BC%9E",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    assert_eq!(items(&listed).len(), 1);

    let (status, missing_name) = send(
        &router,
        Method::POST,
        "/v1/local/services",
        Some(("Bearer", access)),
        Some(json!({
            "category": "维修",
            "address": "轻心路",
            "latitude": 31.23,
            "longitude": 121.47
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{missing_name}");
}

#[tokio::test]
async fn rejecting_moderator_blocks_review_and_publish() {
    let mut state = AppState::connect(Config::test())
        .await
        .expect("connect test db");
    state.moderator = Arc::new(RejectModerator);
    let router = app(state.clone());
    let created = register_user(&router, "local-mod@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/local/services?q=%E5%AE%A0%E7%89%A9%E5%8C%BB%E9%99%A2",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    let id = items(&listed)[0]["id"].as_str().unwrap();

    let (status, review) = send(
        &router,
        Method::POST,
        &format!("/v1/local/services/{id}/reviews"),
        Some(("Bearer", access)),
        Some(json!({ "content": "医生很耐心", "rating": 5 })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{review}");
    assert_eq!(review["error"]["code"], "invalid_request");
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reviews")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(count, 0);

    let (status, publish) = send(
        &router,
        Method::POST,
        "/v1/local/services",
        Some(("Bearer", access)),
        Some(json!({
            "name": "被拦下的店",
            "category": "维修",
            "address": "轻心路",
            "latitude": 31.23,
            "longitude": 121.47
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{publish}");
    let published: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM services WHERE name = '被拦下的店'")
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert_eq!(published, 0);
}

#[tokio::test]
async fn privacy_export_includes_local_life_and_delete_cascades() {
    let (router, state) = world().await;
    let created = register_user(&router, "keep-local@qingxin.app").await;
    let access = created["access_token"].as_str().unwrap();

    let (status, listed) = send(
        &router,
        Method::GET,
        "/v1/local/services?q=%E5%AE%A0%E7%89%A9%E5%8C%BB%E9%99%A2",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{listed}");
    let seed_id = items(&listed)[0]["id"].as_str().unwrap().to_string();

    let (status, review) = send(
        &router,
        Method::POST,
        &format!("/v1/local/services/{seed_id}/reviews"),
        Some(("Bearer", access)),
        Some(json!({ "content": "医生很耐心", "rating": 5 })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{review}");

    let (status, submitted) = send(
        &router,
        Method::POST,
        "/v1/local/services",
        Some(("Bearer", access)),
        Some(json!({
            "name": "我的维修摊",
            "category": "维修",
            "address": "轻心路 3 号",
            "latitude": 31.2295,
            "longitude": 121.4730
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{submitted}");

    let (status, correction) = send(
        &router,
        Method::POST,
        &format!("/v1/local/services/{seed_id}/corrections"),
        Some(("Bearer", access)),
        Some(json!({ "kind": "已搬迁" })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{correction}");

    let (status, export) = send(
        &router,
        Method::GET,
        "/v1/privacy/export",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{export}");
    assert_eq!(export["local_reviews"][0]["id"], review["id"]);
    assert_eq!(export["local_services"][0]["id"], submitted["id"]);
    assert_eq!(export["local_corrections"][0]["id"], correction["id"]);

    let seed_before: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM services WHERE created_by IS NULL")
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert!(seed_before >= 1);

    let (status, _) = send(
        &router,
        Method::DELETE,
        "/v1/privacy/account",
        Some(("Bearer", access)),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);

    let reviews: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reviews")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let corrections: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM service_corrections")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let mine: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM services WHERE name = '我的维修摊'")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let seeds: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM services WHERE created_by IS NULL")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(reviews, 0);
    assert_eq!(corrections, 0);
    assert_eq!(mine, 0);
    assert_eq!(seeds, seed_before);
}
