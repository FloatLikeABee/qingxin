mod budgets;
mod categories;
mod challenges;
mod subscriptions;
mod summary;
mod transactions;

use axum::extract::State;
use axum::http::header;
use axum::response::IntoResponse;
use axum::routing::{delete, get, patch, post};
use axum::Router;
use chrono::{Duration, Months, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;

use crate::auth::AuthUser;
use crate::crypto::FieldCrypto;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/v1/finance/categories",
            get(categories::list).post(categories::create),
        )
        .route(
            "/v1/finance/categories/{id}",
            patch(categories::patch).delete(categories::delete),
        )
        .route(
            "/v1/finance/transactions",
            get(transactions::list).post(transactions::create),
        )
        .route(
            "/v1/finance/transactions/{id}",
            get(transactions::get)
                .patch(transactions::patch)
                .delete(transactions::delete),
        )
        .route("/v1/finance/summary", get(summary::summary))
        .route("/v1/finance/report", get(summary::report))
        .route(
            "/v1/finance/budgets",
            get(budgets::list).put(budgets::upsert),
        )
        .route(
            "/v1/finance/subscriptions/upcoming",
            get(subscriptions::upcoming),
        )
        .route(
            "/v1/finance/subscriptions",
            get(subscriptions::list).post(subscriptions::create),
        )
        .route(
            "/v1/finance/subscriptions/{id}",
            patch(subscriptions::patch).delete(subscriptions::delete),
        )
        .route(
            "/v1/finance/challenges",
            get(challenges::list).post(challenges::create),
        )
        .route("/v1/finance/challenges/{id}", delete(challenges::delete))
        .route(
            "/v1/finance/challenges/{id}/checkins",
            post(challenges::checkin),
        )
        .route("/v1/finance/export.csv", get(export_csv))
}

pub fn shanghai_today() -> NaiveDate {
    (Utc::now() + Duration::hours(8)).date_naive()
}

pub fn parse_date(raw: &str) -> Result<NaiveDate, AppError> {
    NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d")
        .map_err(|_| AppError::InvalidRequest("date must be YYYY-MM-DD".into()))
}

pub fn parse_month(raw: &str) -> Result<NaiveDate, AppError> {
    NaiveDate::parse_from_str(&format!("{}-01", raw.trim()), "%Y-%m-%d")
        .map_err(|_| AppError::InvalidRequest("month must be YYYY-MM".into()))
}

pub fn month_bounds(month: &str) -> Result<(String, String), AppError> {
    let start = parse_month(month)?;
    let end = start
        .checked_add_months(Months::new(1))
        .and_then(|d| d.pred_opt())
        .ok_or_else(|| AppError::InvalidRequest("month is out of range".into()))?;
    Ok((start.to_string(), end.to_string()))
}

pub fn require_fen(amount: i64) -> Result<i64, AppError> {
    if amount <= 0 {
        return Err(AppError::InvalidRequest("amount_fen must be > 0".into()));
    }
    Ok(amount)
}

pub fn require_cny(currency: Option<&str>) -> Result<(), AppError> {
    if let Some(code) = currency {
        if code != "CNY" {
            return Err(AppError::InvalidRequest("currency must be CNY".into()));
        }
    }
    Ok(())
}

pub fn require_kind(kind: &str) -> Result<&str, AppError> {
    match kind {
        "income" | "expense" => Ok(kind),
        _ => Err(AppError::InvalidRequest(
            "type must be income or expense".into(),
        )),
    }
}

pub fn require_cycle(cycle: &str) -> Result<&str, AppError> {
    match cycle {
        "weekly" | "monthly" | "quarterly" | "yearly" => Ok(cycle),
        _ => Err(AppError::InvalidRequest(
            "cycle must be weekly, monthly, quarterly or yearly".into(),
        )),
    }
}

pub fn annual_cost_fen(price_fen: i64, cycle: &str) -> i64 {
    match cycle {
        "weekly" => price_fen.saturating_mul(52),
        "monthly" => price_fen.saturating_mul(12),
        "quarterly" => price_fen.saturating_mul(4),
        _ => price_fen,
    }
}

pub fn add_cycle(date: NaiveDate, cycle: &str) -> Result<NaiveDate, AppError> {
    match cycle {
        "weekly" => date.checked_add_signed(Duration::days(7)),
        "monthly" => date.checked_add_months(Months::new(1)),
        "quarterly" => date.checked_add_months(Months::new(3)),
        "yearly" => date.checked_add_months(Months::new(12)),
        _ => None,
    }
    .ok_or_else(|| AppError::InvalidRequest("could not advance billing date".into()))
}

pub fn roll_billing_date(
    mut next: NaiveDate,
    cycle: &str,
    today: NaiveDate,
) -> Result<NaiveDate, AppError> {
    let mut guard = 0;
    while next < today {
        next = add_cycle(next, cycle)?;
        guard += 1;
        if guard > 120 {
            return Err(AppError::InvalidRequest(
                "could not roll billing date".into(),
            ));
        }
    }
    Ok(next)
}

pub fn encrypt_note(crypto: &FieldCrypto, note: Option<&str>) -> Result<Option<Vec<u8>>, AppError> {
    let Some(note) = note.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if note.chars().count() > 200 {
        return Err(AppError::InvalidRequest(
            "note must be at most 200 characters".into(),
        ));
    }
    Ok(Some(crypto.encrypt(note.as_bytes())?))
}

pub fn decrypt_note(crypto: &FieldCrypto, blob: Option<&[u8]>) -> Option<String> {
    blob.and_then(|bytes| crypto.decrypt(bytes).ok())
        .and_then(|plain| String::from_utf8(plain).ok())
}

pub fn require_client_id(raw: &str) -> Result<String, AppError> {
    let trimmed = raw.trim();
    uuid::Uuid::parse_str(trimmed)
        .map_err(|_| AppError::InvalidRequest("client_id must be a UUID".into()))?;
    Ok(trimmed.to_string())
}

#[derive(FromRow)]
struct CategoryRow {
    id: String,
    user_id: Option<String>,
    name: String,
    kind: String,
    sort_order: i64,
}

impl CategoryRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "kind": self.kind,
            "sort_order": self.sort_order,
            "system": self.user_id.is_none(),
        })
    }
}

#[derive(FromRow)]
struct TxRow {
    id: String,
    amount_fen: i64,
    type_name: String,
    category_id: String,
    category_name: String,
    note_encrypted: Option<Vec<u8>>,
    occurred_on: String,
    client_id: String,
    created_at: String,
    updated_at: String,
}

impl TxRow {
    fn public(&self, crypto: &FieldCrypto) -> Value {
        json!({
            "id": self.id,
            "amount_fen": self.amount_fen,
            "currency": "CNY",
            "type": self.type_name,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "note": decrypt_note(crypto, self.note_encrypted.as_deref()),
            "occurred_on": self.occurred_on,
            "client_id": self.client_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        })
    }
}

const TX_SELECT: &str = "SELECT t.id, t.amount_fen, t.type AS type_name, t.category_id,
        c.name AS category_name, t.note_encrypted, t.occurred_on, t.client_id,
        t.created_at, t.updated_at
     FROM fin_transactions t
     JOIN fin_categories c ON c.id = t.category_id";

async fn load_tx(state: &AppState, user_id: &str, id: &str) -> Result<TxRow, AppError> {
    sqlx::query_as::<_, TxRow>(&format!(
        "{TX_SELECT} WHERE t.id = ? AND t.user_id = ? AND t.deleted_at IS NULL"
    ))
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::NotFound)
}

async fn load_category_for_user(
    state: &AppState,
    user_id: &str,
    category_id: &str,
) -> Result<CategoryRow, AppError> {
    sqlx::query_as::<_, CategoryRow>(
        "SELECT id, user_id, name, kind, sort_order FROM fin_categories
         WHERE id = ? AND (user_id IS NULL OR user_id = ?)",
    )
    .bind(category_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)?
    .ok_or(AppError::InvalidRequest("category_id is invalid".into()))
}

pub async fn export_for_user(state: &AppState, user_id: &str) -> Result<Value, AppError> {
    let categories = sqlx::query_as::<_, CategoryRow>(
        "SELECT id, user_id, name, kind, sort_order FROM fin_categories
         WHERE user_id IS NULL OR user_id = ?
         ORDER BY kind, sort_order, name",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let txs = sqlx::query_as::<_, TxRow>(&format!(
        "{TX_SELECT} WHERE t.user_id = ? AND t.deleted_at IS NULL
         ORDER BY t.occurred_on DESC, t.id DESC"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let budgets = budgets::export_rows(state, user_id).await?;
    let subscriptions = subscriptions::export_rows(state, user_id).await?;
    let challenges = challenges::export_rows(state, user_id).await?;
    Ok(json!({
        "categories": categories.iter().map(CategoryRow::public).collect::<Vec<_>>(),
        "transactions": txs.iter().map(|row| row.public(&state.crypto)).collect::<Vec<_>>(),
        "budgets": budgets,
        "subscriptions": subscriptions,
        "challenges": challenges,
    }))
}

pub async fn maintain_reminders(state: &AppState) -> Result<(), AppError> {
    subscriptions::maintain_all(state).await
}

async fn export_csv(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    let txs = sqlx::query_as::<_, TxRow>(&format!(
        "{TX_SELECT} WHERE t.user_id = ? AND t.deleted_at IS NULL
         ORDER BY t.occurred_on DESC, t.id DESC"
    ))
    .bind(&user.user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let mut csv = String::from("id,occurred_on,type,category,amount_fen,currency,note\n");
    for row in txs {
        let note = decrypt_note(&state.crypto, row.note_encrypted.as_deref()).unwrap_or_default();
        csv.push_str(&format!(
            "{},{},{},{},{},CNY,{}\n",
            csv_escape(&row.id),
            csv_escape(&row.occurred_on),
            csv_escape(&row.type_name),
            csv_escape(&row.category_name),
            row.amount_fen,
            csv_escape(&note),
        ));
    }
    Ok((
        [
            (header::CONTENT_TYPE, "text/csv; charset=utf-8"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=\"qingxin-finance.csv\"",
            ),
        ],
        csv,
    ))
}

fn csv_escape(raw: &str) -> String {
    if raw.contains([',', '"', '\n']) {
        format!("\"{}\"", raw.replace('"', "\"\""))
    } else {
        raw.to_string()
    }
}

#[derive(Deserialize)]
struct MonthQuery {
    month: Option<String>,
}

#[derive(Deserialize)]
struct TxQuery {
    month: Option<String>,
    #[serde(rename = "type")]
    type_name: Option<String>,
    category_id: Option<String>,
    cursor: Option<String>,
    limit: Option<i64>,
}

#[derive(Deserialize)]
struct ReportQuery {
    from: String,
    to: String,
    group: Option<String>,
}

#[derive(Deserialize)]
struct UpcomingQuery {
    days: Option<i64>,
}

#[derive(Deserialize)]
struct CreateCategoryBody {
    name: String,
    kind: String,
}

#[derive(Deserialize)]
struct PatchCategoryBody {
    name: Option<String>,
}

#[derive(Deserialize)]
struct CreateTxBody {
    amount_fen: i64,
    currency: Option<String>,
    #[serde(rename = "type")]
    type_name: String,
    category_id: String,
    note: Option<String>,
    occurred_on: String,
    client_id: String,
}

#[derive(Deserialize)]
struct PatchTxBody {
    amount_fen: Option<i64>,
    #[serde(rename = "type")]
    type_name: Option<String>,
    category_id: Option<String>,
    note: Option<String>,
    occurred_on: Option<String>,
}

#[derive(Deserialize)]
struct BudgetItemBody {
    category_id: Option<String>,
    monthly_limit_fen: i64,
    alert_threshold_pct: Option<i64>,
}

#[derive(Deserialize)]
struct PutBudgetsBody {
    items: Vec<BudgetItemBody>,
}

#[derive(Deserialize)]
struct CreateSubBody {
    name: String,
    price_fen: i64,
    currency: Option<String>,
    cycle: String,
    next_billing_date: String,
    remind_days_before: Option<i64>,
    active: Option<bool>,
}

#[derive(Deserialize)]
struct PatchSubBody {
    name: Option<String>,
    price_fen: Option<i64>,
    cycle: Option<String>,
    next_billing_date: Option<String>,
    remind_days_before: Option<i64>,
    active: Option<bool>,
}

#[derive(Deserialize)]
struct CreateChallengeBody {
    name: String,
    target_days: i64,
    target_amount_fen: Option<i64>,
    start_date: Option<String>,
}

#[derive(Deserialize)]
struct CheckinBody {
    day: Option<String>,
}
