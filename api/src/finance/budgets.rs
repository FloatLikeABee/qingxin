use axum::extract::State;
use axum::Json;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{require_fen, PutBudgetsBody};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow)]
pub struct BudgetRow {
    pub id: String,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub monthly_limit_fen: i64,
    pub alert_threshold_pct: i64,
}

impl BudgetRow {
    pub fn public(&self) -> Value {
        json!({
            "id": self.id,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "monthly_limit_fen": self.monthly_limit_fen,
            "alert_threshold_pct": self.alert_threshold_pct,
            "currency": "CNY",
        })
    }
}

const BUDGET_SELECT: &str = "SELECT b.id, b.category_id, c.name AS category_name,
        b.monthly_limit_fen, b.alert_threshold_pct
     FROM fin_budgets b
     LEFT JOIN fin_categories c ON c.id = b.category_id";

pub async fn list(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    Ok(Json(
        json!({ "items": export_rows(&state, &user.user_id).await? }),
    ))
}

pub async fn upsert(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<PutBudgetsBody>,
) -> Result<Json<Value>, AppError> {
    for item in &body.items {
        let limit = require_fen(item.monthly_limit_fen)?;
        let threshold = item.alert_threshold_pct.unwrap_or(80);
        if !(1..=100).contains(&threshold) {
            return Err(AppError::InvalidRequest(
                "alert_threshold_pct must be 1-100".into(),
            ));
        }
        if let Some(category_id) = item.category_id.as_deref() {
            super::load_category_for_user(&state, &user.user_id, category_id).await?;
        }
        let existing = if let Some(category_id) = item.category_id.as_deref() {
            sqlx::query_scalar::<_, String>(
                "SELECT id FROM fin_budgets WHERE user_id = ? AND category_id = ?",
            )
            .bind(&user.user_id)
            .bind(category_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(map_sqlx)?
        } else {
            sqlx::query_scalar::<_, String>(
                "SELECT id FROM fin_budgets WHERE user_id = ? AND category_id IS NULL",
            )
            .bind(&user.user_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(map_sqlx)?
        };
        let now = now_rfc3339();
        if let Some(id) = existing {
            sqlx::query(
                "UPDATE fin_budgets
                 SET monthly_limit_fen = ?, alert_threshold_pct = ?, updated_at = ?
                 WHERE id = ? AND user_id = ?",
            )
            .bind(limit)
            .bind(threshold)
            .bind(&now)
            .bind(id)
            .bind(&user.user_id)
            .execute(&state.pool)
            .await
            .map_err(map_sqlx)?;
        } else {
            sqlx::query(
                "INSERT INTO fin_budgets
                    (id, user_id, category_id, monthly_limit_fen, alert_threshold_pct, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(new_id())
            .bind(&user.user_id)
            .bind(&item.category_id)
            .bind(limit)
            .bind(threshold)
            .bind(&now)
            .bind(&now)
            .execute(&state.pool)
            .await
            .map_err(map_sqlx)?;
        }
    }
    Ok(Json(
        json!({ "items": export_rows(&state, &user.user_id).await? }),
    ))
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    let rows = sqlx::query_as::<_, BudgetRow>(&format!(
        "{BUDGET_SELECT} WHERE b.user_id = ? ORDER BY c.sort_order, b.id"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(rows.iter().map(BudgetRow::public).collect())
}

pub async fn rows_for_user(state: &AppState, user_id: &str) -> Result<Vec<BudgetRow>, AppError> {
    sqlx::query_as::<_, BudgetRow>(&format!("{BUDGET_SELECT} WHERE b.user_id = ?"))
        .bind(user_id)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)
}
