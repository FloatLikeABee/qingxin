pub mod ai;
pub mod auth;
pub mod config;
pub mod create;
pub mod crypto;
pub mod db;
pub mod elder;
pub mod error;
pub mod finance;
pub mod hustle;
pub mod moderation;
pub mod mood;
pub mod push;
pub mod routes;
pub mod scheduler;
pub mod state;
pub mod util;
pub mod wellness;

pub use config::Config;
pub use state::AppState;

use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

pub fn app(state: AppState) -> Router {
    routes::router()
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state)
}
