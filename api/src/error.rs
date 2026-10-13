use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    InvalidRequest(String),
    #[error("invalid credentials")]
    InvalidCredentials,
    #[error("unauthenticated")]
    Unauthenticated,
    #[error("forbidden")]
    Forbidden,
    #[error("not found")]
    NotFound,
    #[error("conflict")]
    Conflict,
    #[error("ai gateway is not configured")]
    AiUnconfigured,
    #[error("{0}")]
    Unavailable(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidRequest(_) => "invalid_request",
            Self::InvalidCredentials => "invalid_credentials",
            Self::Unauthenticated => "unauthenticated",
            Self::Forbidden => "forbidden",
            Self::NotFound => "not_found",
            Self::Conflict => "conflict",
            Self::AiUnconfigured => "ai_unconfigured",
            Self::Unavailable(_) => "unavailable",
        }
    }

    pub fn status(&self) -> StatusCode {
        match self {
            Self::InvalidRequest(_) => StatusCode::BAD_REQUEST,
            Self::InvalidCredentials => StatusCode::UNAUTHORIZED,
            Self::Unauthenticated => StatusCode::UNAUTHORIZED,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Conflict => StatusCode::CONFLICT,
            Self::AiUnconfigured => StatusCode::NOT_IMPLEMENTED,
            Self::Unavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": {
                "code": self.code(),
                "message": self.to_string(),
            }
        });
        (self.status(), Json(body)).into_response()
    }
}

pub fn map_sqlx(err: sqlx::Error) -> AppError {
    if let sqlx::Error::Database(db) = &err {
        if db.is_unique_violation() {
            return AppError::Conflict;
        }
    }
    tracing::error!(error = %err, "database error");
    AppError::Unavailable("database error".into())
}
