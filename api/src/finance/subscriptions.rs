use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{Duration, NaiveDate, SecondsFormat, Utc};
use serde_json::{json, Value};
use sqlx::FromRow;

use super::{
    annual_cost_fen, parse_date, require_cny, require_cycle, require_fen, roll_billing_date,
    shanghai_today, CreateSubBody, PatchSubBody, UpcomingQuery,
};
use crate::auth::AuthUser;
use crate::error::{map_sqlx, AppError};
use crate::state::AppState;
use crate::util::{new_id, now_rfc3339};

#[derive(FromRow, Clone)]
struct SubRow {
    id: String,
    user_id: String,
    name: String,
    price_fen: i64,
    cycle: String,
    next_billing_date: String,
    remind_days_before: i64,
    active: i64,
    reminder_job_id: Option<String>,
}

impl SubRow {
    fn public(&self) -> Value {
        json!({
            "id": self.id,
            "name": self.name,
            "price_fen": self.price_fen,
            "currency": "CNY",
            "cycle": self.cycle,
            "next_billing_date": self.next_billing_date,
            "remind_days_before": self.remind_days_before,
            "active": self.active != 0,
            "annual_cost_fen": annual_cost_fen(self.price_fen, &self.cycle),
        })
    }
}

const SUB_SELECT: &str = "SELECT id, user_id, name, price_fen, cycle, next_billing_date,
        remind_days_before, active, reminder_job_id
     FROM fin_subscriptions";

pub async fn list(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, AppError> {
    maintain_user(&state, &user.user_id).await?;
    Ok(Json(
        json!({ "items": export_rows(&state, &user.user_id).await? }),
    ))
}

pub async fn upcoming(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<UpcomingQuery>,
) -> Result<Json<Value>, AppError> {
    maintain_user(&state, &user.user_id).await?;
    let days = query.days.unwrap_or(7).clamp(1, 90);
    let today = shanghai_today();
    let items: Vec<Value> = load_user(&state, &user.user_id)
        .await?
        .into_iter()
        .filter(|row| {
            row.active != 0
                && parse_date(&row.next_billing_date).ok().is_some_and(|next| {
                    if next < today {
                        return false;
                    }
                    let until = (next - today).num_days();
                    until <= row.remind_days_before && until <= days
                })
        })
        .map(|row| row.public())
        .collect();
    Ok(Json(json!({ "items": items })))
}

pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateSubBody>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    let price = require_fen(body.price_fen)?;
    require_cny(body.currency.as_deref())?;
    let cycle = require_cycle(body.cycle.trim())?;
    let name = require_name(&body.name)?;
    let remind = body.remind_days_before.unwrap_or(3);
    if !(0..=30).contains(&remind) {
        return Err(AppError::InvalidRequest(
            "remind_days_before must be 0-30".into(),
        ));
    }
    let today = shanghai_today();
    let next = roll_billing_date(parse_date(&body.next_billing_date)?, cycle, today)?;
    let active = body.active.unwrap_or(true);
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO fin_subscriptions
            (id, user_id, name, price_fen, cycle, next_billing_date, remind_days_before, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(name)
    .bind(price)
    .bind(cycle)
    .bind(next.to_string())
    .bind(remind)
    .bind(i64::from(active))
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    sync_job(&state, &id).await?;
    let row = load_one(&state, &user.user_id, &id).await?;
    Ok((StatusCode::CREATED, Json(row.public())))
}

pub async fn patch(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<PatchSubBody>,
) -> Result<Json<Value>, AppError> {
    let current = load_one(&state, &user.user_id, &id).await?;
    let name = match body.name.as_deref() {
        Some(raw) => require_name(raw)?,
        None => current.name.clone(),
    };
    let price = match body.price_fen {
        Some(value) => require_fen(value)?,
        None => current.price_fen,
    };
    let cycle = match body.cycle.as_deref() {
        Some(raw) => require_cycle(raw)?.to_string(),
        None => current.cycle.clone(),
    };
    let remind = match body.remind_days_before {
        Some(value) if (0..=30).contains(&value) => value,
        Some(_) => {
            return Err(AppError::InvalidRequest(
                "remind_days_before must be 0-30".into(),
            ))
        }
        None => current.remind_days_before,
    };
    let today = shanghai_today();
    let next = match body.next_billing_date.as_deref() {
        Some(raw) => roll_billing_date(parse_date(raw)?, &cycle, today)?,
        None => roll_billing_date(parse_date(&current.next_billing_date)?, &cycle, today)?,
    };
    let active = body.active.map(i64::from).unwrap_or(current.active);
    sqlx::query(
        "UPDATE fin_subscriptions
         SET name = ?, price_fen = ?, cycle = ?, next_billing_date = ?, remind_days_before = ?,
             active = ?, updated_at = ?
         WHERE id = ? AND user_id = ?",
    )
    .bind(name)
    .bind(price)
    .bind(&cycle)
    .bind(next.to_string())
    .bind(remind)
    .bind(active)
    .bind(now_rfc3339())
    .bind(&id)
    .bind(&user.user_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    sync_job(&state, &id).await?;
    let row = load_one(&state, &user.user_id, &id).await?;
    Ok(Json(row.public()))
}

pub async fn delete(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let row = load_one(&state, &user.user_id, &id).await?;
    if let Some(job_id) = row.reminder_job_id {
        cancel_job(&state, &job_id).await?;
    }
    sqlx::query("DELETE FROM fin_subscriptions WHERE id = ? AND user_id = ?")
        .bind(id)
        .bind(&user.user_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn export_rows(state: &AppState, user_id: &str) -> Result<Vec<Value>, AppError> {
    Ok(load_user(state, user_id)
        .await?
        .into_iter()
        .map(|row| row.public())
        .collect())
}

pub async fn maintain_all(state: &AppState) -> Result<(), AppError> {
    let ids: Vec<String> = sqlx::query_scalar("SELECT DISTINCT user_id FROM fin_subscriptions")
        .fetch_all(&state.pool)
        .await
        .map_err(map_sqlx)?;
    for user_id in ids {
        maintain_user(state, &user_id).await?;
    }
    Ok(())
}

async fn maintain_user(state: &AppState, user_id: &str) -> Result<(), AppError> {
    let today = shanghai_today();
    for row in load_user(state, user_id).await? {
        let rolled = roll_billing_date(parse_date(&row.next_billing_date)?, &row.cycle, today)?;
        if rolled.to_string() != row.next_billing_date {
            sqlx::query(
                "UPDATE fin_subscriptions SET next_billing_date = ?, updated_at = ? WHERE id = ?",
            )
            .bind(rolled.to_string())
            .bind(now_rfc3339())
            .bind(&row.id)
            .execute(&state.pool)
            .await
            .map_err(map_sqlx)?;
        }
        sync_job(state, &row.id).await?;
    }
    Ok(())
}

async fn sync_job(state: &AppState, subscription_id: &str) -> Result<(), AppError> {
    let row = sqlx::query_as::<_, SubRow>(&format!("{SUB_SELECT} WHERE id = ?"))
        .bind(subscription_id)
        .fetch_one(&state.pool)
        .await
        .map_err(map_sqlx)?;
    if row.active == 0 {
        if let Some(job_id) = &row.reminder_job_id {
            cancel_job(state, job_id).await?;
        }
        sqlx::query("UPDATE fin_subscriptions SET reminder_job_id = NULL WHERE id = ?")
            .bind(subscription_id)
            .execute(&state.pool)
            .await
            .map_err(map_sqlx)?;
        return Ok(());
    }
    let next = parse_date(&row.next_billing_date)?;
    if let Some(job_id) = &row.reminder_job_id {
        if let Some((status, payload_json)) = job_status(state, job_id).await? {
            let payload: Value = serde_json::from_str(&payload_json).unwrap_or(Value::Null);
            let same_cycle = payload["next_billing_date"] == row.next_billing_date;
            if same_cycle && status != "cancelled" && status != "failed" {
                return Ok(());
            }
            if status == "pending" {
                cancel_job(state, job_id).await?;
            }
        }
    }
    let run_at = reminder_run_at(next, row.remind_days_before);
    let job_id = new_id();
    let payload = json!({
        "source": "finance_subscription",
        "subscription_id": row.id,
        "next_billing_date": row.next_billing_date,
        "title": "订阅续费提醒",
        "body": format!("{} 将于 {} 续费", row.name, row.next_billing_date),
    });
    sqlx::query(
        "INSERT INTO scheduled_jobs
            (id, user_id, kind, payload_json, run_at, status, attempts, created_at)
         VALUES (?, ?, 'web_push', ?, ?, 'pending', 0, ?)",
    )
    .bind(&job_id)
    .bind(&row.user_id)
    .bind(payload.to_string())
    .bind(&run_at)
    .bind(now_rfc3339())
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    sqlx::query("UPDATE fin_subscriptions SET reminder_job_id = ? WHERE id = ?")
        .bind(&job_id)
        .bind(subscription_id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
    Ok(())
}

fn reminder_run_at(next: NaiveDate, remind_days: i64) -> String {
    let remind_on = next - Duration::days(remind_days);
    let today = shanghai_today();
    if remind_on <= today {
        return (Utc::now() - Duration::minutes(1)).to_rfc3339_opts(SecondsFormat::Secs, true);
    }
    remind_on
        .and_hms_opt(1, 0, 0)
        .map(|naive| naive.and_utc().to_rfc3339_opts(SecondsFormat::Secs, true))
        .unwrap_or_else(|| {
            (Utc::now() - Duration::minutes(1)).to_rfc3339_opts(SecondsFormat::Secs, true)
        })
}

async fn job_status(state: &AppState, job_id: &str) -> Result<Option<(String, String)>, AppError> {
    sqlx::query_as::<_, (String, String)>(
        "SELECT status, payload_json FROM scheduled_jobs WHERE id = ?",
    )
    .bind(job_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(map_sqlx)
}

async fn cancel_job(state: &AppState, job_id: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE scheduled_jobs SET status = 'cancelled' WHERE id = ? AND status = 'pending'",
    )
    .bind(job_id)
    .execute(&state.pool)
    .await
    .map_err(map_sqlx)?;
    Ok(())
}

async fn load_user(state: &AppState, user_id: &str) -> Result<Vec<SubRow>, AppError> {
    sqlx::query_as::<_, SubRow>(&format!(
        "{SUB_SELECT} WHERE user_id = ? ORDER BY next_billing_date, name"
    ))
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)
}

async fn load_one(state: &AppState, user_id: &str, id: &str) -> Result<SubRow, AppError> {
    sqlx::query_as::<_, SubRow>(&format!("{SUB_SELECT} WHERE id = ? AND user_id = ?"))
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(map_sqlx)?
        .ok_or(AppError::NotFound)
}

fn require_name(raw: &str) -> Result<String, AppError> {
    let name = raw.trim();
    if name.is_empty() || name.chars().count() > 64 {
        return Err(AppError::InvalidRequest("name is invalid".into()));
    }
    Ok(name.to_string())
}
