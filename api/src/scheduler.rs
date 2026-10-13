use std::time::Duration;

use serde_json::Value;
use sqlx::FromRow;

use crate::error::{map_sqlx, AppError};
use crate::push::PushMessage;
use crate::state::AppState;
use crate::util::now_rfc3339;

#[derive(FromRow)]
struct JobRow {
    id: String,
    user_id: String,
    payload_json: String,
}

pub async fn run(state: AppState) {
    let mut interval = tokio::time::interval(Duration::from_millis(
        state.config.scheduler_interval_ms.max(50),
    ));
    loop {
        interval.tick().await;
        if let Err(err) = tick_once(&state).await {
            tracing::error!(error = %err, "scheduler tick failed");
        }
    }
}

pub async fn tick_once(state: &AppState) -> Result<usize, AppError> {
    let now = now_rfc3339();
    let due = sqlx::query_as::<_, JobRow>(
        "SELECT id, user_id, payload_json FROM scheduled_jobs
         WHERE status = 'pending' AND run_at <= ?
         ORDER BY run_at ASC
         LIMIT 50",
    )
    .bind(&now)
    .fetch_all(&state.pool)
    .await
    .map_err(map_sqlx)?;

    let mut sent = 0usize;
    for job in due {
        let claimed = sqlx::query(
            "UPDATE scheduled_jobs SET status = 'running', attempts = attempts + 1
             WHERE id = ? AND status = 'pending'",
        )
        .bind(&job.id)
        .execute(&state.pool)
        .await
        .map_err(map_sqlx)?;
        if claimed.rows_affected() != 1 {
            continue;
        }

        let payload = serde_json::from_str::<Value>(&job.payload_json).unwrap_or(Value::Null);
        let result = state
            .push
            .send(&PushMessage {
                user_id: job.user_id.clone(),
                job_id: job.id.clone(),
                payload: payload.clone(),
            })
            .await;

        match result {
            Ok(()) => {
                if let Err(err) =
                    crate::elder::after_job(state, &job.user_id, &job.id, &payload).await
                {
                    tracing::error!(error = %err, job_id = %job.id, "elder after_job failed");
                    sqlx::query(
                        "UPDATE scheduled_jobs SET status = 'failed', last_error = ? WHERE id = ?",
                    )
                    .bind(err.to_string())
                    .bind(&job.id)
                    .execute(&state.pool)
                    .await
                    .map_err(map_sqlx)?;
                } else {
                    sqlx::query(
                        "UPDATE scheduled_jobs SET status = 'done', last_error = NULL WHERE id = ?",
                    )
                    .bind(&job.id)
                    .execute(&state.pool)
                    .await
                    .map_err(map_sqlx)?;
                    sent += 1;
                }
            }
            Err(err) => {
                sqlx::query(
                    "UPDATE scheduled_jobs SET status = 'failed', last_error = ? WHERE id = ?",
                )
                .bind(err.to_string())
                .bind(&job.id)
                .execute(&state.pool)
                .await
                .map_err(map_sqlx)?;
            }
        }
    }
    crate::finance::maintain_reminders(state).await?;
    Ok(sent)
}
