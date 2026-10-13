use axum::extract::{Query, State};
use axum::Json;
use chrono::Months;
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{month_bounds, parse_month, MonthQuery, ReportQuery, TxRow, TX_SELECT};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;

#[derive(FromRow)]
struct TotalsRow {
    income_fen: i64,
    expense_fen: i64,
}

#[derive(FromRow)]
struct SliceRow {
    key: String,
    kind: String,
    category_id: Option<String>,
    amount_fen: i64,
}

pub async fn summary(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<MonthQuery>,
) -> Result<Json<Value>, AppError> {
    let month = query
        .month
        .clone()
        .unwrap_or_else(|| super::shanghai_today().format("%Y-%m").to_string());
    let (start, end) = month_bounds(&month)?;
    let totals = period_totals(&state, &user.user_id, &start, &end).await?;
    let slices = sqlx::query_as::<_, SliceRow>(
        "SELECT c.name AS key, t.type AS kind, t.category_id AS category_id,
                COALESCE(SUM(t.amount_fen), 0) AS amount_fen
         FROM fin_transactions t
         JOIN fin_categories c ON c.id = t.category_id
         WHERE t.user_id = ? AND t.deleted_at IS NULL
           AND t.occurred_on >= ? AND t.occurred_on <= ?
         GROUP BY t.category_id, c.name, t.type
         ORDER BY amount_fen DESC",
    )
    .bind(&user.user_id)
    .bind(&start)
    .bind(&end)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    let budgets = crate::finance::budgets::rows_for_user(&state, &user.user_id).await?;
    let mut budget_json = Vec::new();
    for budget in budgets {
        let spent = if let Some(category_id) = &budget.category_id {
            slices
                .iter()
                .filter(|row| row.category_id.as_deref() == Some(category_id.as_str()))
                .map(|row| row.amount_fen)
                .sum::<i64>()
        } else {
            totals.expense_fen
        };
        let pct = if budget.monthly_limit_fen <= 0 {
            0
        } else {
            (spent * 100) / budget.monthly_limit_fen
        };
        budget_json.push(json!({
            "id": budget.id,
            "category_id": budget.category_id,
            "category_name": budget.category_name,
            "monthly_limit_fen": budget.monthly_limit_fen,
            "alert_threshold_pct": budget.alert_threshold_pct,
            "spent_fen": spent,
            "pct": pct,
            "alert": pct >= budget.alert_threshold_pct,
            "currency": "CNY",
        }));
    }
    let recent = sqlx::query_as::<_, TxRow>(&format!(
        "{TX_SELECT} WHERE t.user_id = ? AND t.deleted_at IS NULL
           AND t.occurred_on >= ? AND t.occurred_on <= ?
         ORDER BY t.occurred_on DESC, t.created_at DESC, t.id DESC
         LIMIT 5"
    ))
    .bind(&user.user_id)
    .bind(&start)
    .bind(&end)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(Json(json!({
        "month": month,
        "currency": "CNY",
        "income_fen": totals.income_fen,
        "expense_fen": totals.expense_fen,
        "balance_fen": totals.income_fen - totals.expense_fen,
        "by_category": slices.iter().map(|row| json!({
            "category_id": row.category_id,
            "category_name": row.key,
            "kind": row.kind,
            "amount_fen": row.amount_fen,
            "currency": "CNY",
        })).collect::<Vec<_>>(),
        "budgets": budget_json,
        "recent": recent.iter().map(|row| row.public(&state.crypto)).collect::<Vec<_>>(),
    })))
}

pub async fn report(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<ReportQuery>,
) -> Result<Json<Value>, AppError> {
    let group = query.group.as_deref().unwrap_or("category");
    if group != "category" && group != "month" {
        return Err(AppError::InvalidRequest(
            "group must be category or month".into(),
        ));
    }
    let from = parse_month(&query.from)?;
    let to = parse_month(&query.to)?;
    if to < from {
        return Err(AppError::InvalidRequest(
            "to must be on or after from".into(),
        ));
    }
    let start = from.to_string();
    let end = to
        .checked_add_months(Months::new(1))
        .and_then(|d| d.pred_opt())
        .ok_or_else(|| AppError::InvalidRequest("range is out of bounds".into()))?
        .to_string();
    let current = period_totals(&state, &user.user_id, &start, &end).await?;
    let months = month_span(from, to)?;
    let mom_from = from
        .checked_sub_months(Months::new(months))
        .ok_or_else(|| AppError::InvalidRequest("range is out of bounds".into()))?;
    let mom_to_end = to
        .checked_sub_months(Months::new(months))
        .and_then(|d| d.checked_add_months(Months::new(1)))
        .and_then(|d| d.pred_opt())
        .ok_or_else(|| AppError::InvalidRequest("range is out of bounds".into()))?;
    let yoy_from = from
        .checked_sub_months(Months::new(12))
        .ok_or_else(|| AppError::InvalidRequest("range is out of bounds".into()))?;
    let yoy_to_end = to
        .checked_sub_months(Months::new(12))
        .and_then(|d| d.checked_add_months(Months::new(1)))
        .and_then(|d| d.pred_opt())
        .ok_or_else(|| AppError::InvalidRequest("range is out of bounds".into()))?;
    let mom = period_totals(
        &state,
        &user.user_id,
        &mom_from.to_string(),
        &mom_to_end.to_string(),
    )
    .await?;
    let yoy = period_totals(
        &state,
        &user.user_id,
        &yoy_from.to_string(),
        &yoy_to_end.to_string(),
    )
    .await?;
    let slices = if group == "month" {
        sqlx::query_as::<_, SliceRow>(
            "SELECT substr(t.occurred_on, 1, 7) AS key, 'expense' AS kind,
                    NULL AS category_id, COALESCE(SUM(t.amount_fen), 0) AS amount_fen
             FROM fin_transactions t
             WHERE t.user_id = ? AND t.deleted_at IS NULL AND t.type = 'expense'
               AND t.occurred_on >= ? AND t.occurred_on <= ?
             GROUP BY substr(t.occurred_on, 1, 7)
             ORDER BY key",
        )
        .bind(&user.user_id)
        .bind(&start)
        .bind(&end)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?
    } else {
        sqlx::query_as::<_, SliceRow>(
            "SELECT c.name AS key, t.type AS kind, t.category_id AS category_id,
                    COALESCE(SUM(t.amount_fen), 0) AS amount_fen
             FROM fin_transactions t
             JOIN fin_categories c ON c.id = t.category_id
             WHERE t.user_id = ? AND t.deleted_at IS NULL AND t.type = 'expense'
               AND t.occurred_on >= ? AND t.occurred_on <= ?
             GROUP BY t.category_id, c.name, t.type
             ORDER BY amount_fen DESC",
        )
        .bind(&user.user_id)
        .bind(&start)
        .bind(&end)
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?
    };
    let total = current.expense_fen.max(1);
    Ok(Json(json!({
        "from": query.from,
        "to": query.to,
        "group": group,
        "currency": "CNY",
        "income_fen": current.income_fen,
        "expense_fen": current.expense_fen,
        "mom": delta_block(current.expense_fen, mom.expense_fen),
        "yoy": delta_block(current.expense_fen, yoy.expense_fen),
        "slices": slices.iter().map(|row| json!({
            "key": row.key,
            "kind": row.kind,
            "category_id": row.category_id,
            "amount_fen": row.amount_fen,
            "share_pct": (row.amount_fen * 100) / total,
            "currency": "CNY",
        })).collect::<Vec<_>>(),
    })))
}

fn delta_block(current: i64, previous: i64) -> Value {
    json!({
        "expense_fen": previous,
        "expense_delta_fen": current - previous,
        "expense_delta_pct": if previous == 0 {
            if current == 0 { 0 } else { 100 }
        } else {
            ((current - previous) * 100) / previous
        },
    })
}

fn month_span(from: chrono::NaiveDate, to: chrono::NaiveDate) -> Result<u32, AppError> {
    let mut cursor = from;
    let mut count = 1u32;
    while cursor < to {
        cursor = cursor
            .checked_add_months(Months::new(1))
            .ok_or_else(|| AppError::InvalidRequest("range is out of bounds".into()))?;
        count += 1;
        if count > 120 {
            return Err(AppError::InvalidRequest("range is too large".into()));
        }
    }
    Ok(count)
}

async fn period_totals(
    state: &AppState,
    user_id: &str,
    start: &str,
    end: &str,
) -> Result<TotalsRow, AppError> {
    sqlx::query_as::<_, TotalsRow>(
        "SELECT
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount_fen ELSE 0 END), 0) AS income_fen,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_fen ELSE 0 END), 0) AS expense_fen
         FROM fin_transactions
         WHERE user_id = ? AND deleted_at IS NULL
           AND occurred_on >= ? AND occurred_on <= ?",
    )
    .bind(user_id)
    .bind(start)
    .bind(end)
    .fetch_one(&state.pool)
    .await
    .map_err(map_sqlx)
}
