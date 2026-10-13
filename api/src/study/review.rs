use chrono::NaiveDate;
use serde::Deserialize;

use crate::error::AppError;

pub const DEFAULT_EASE: f64 = 2.5;
pub const MIN_EASE: f64 = 1.3;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Grade {
    Again,
    Hard,
    Good,
    Easy,
}

impl Grade {
    pub fn parse(raw: &str) -> Result<Self, AppError> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "again" => Ok(Self::Again),
            "hard" => Ok(Self::Hard),
            "good" => Ok(Self::Good),
            "easy" => Ok(Self::Easy),
            _ => Err(AppError::InvalidRequest(
                "grade must be again, hard, good or easy".into(),
            )),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ReviewState {
    pub ease: f64,
    pub interval_days: i64,
}

impl Default for ReviewState {
    fn default() -> Self {
        Self {
            ease: DEFAULT_EASE,
            interval_days: 0,
        }
    }
}

pub fn apply_grade(state: ReviewState, grade: Grade) -> ReviewState {
    match grade {
        Grade::Again => ReviewState {
            ease: (state.ease - 0.2).max(MIN_EASE),
            interval_days: 1,
        },
        Grade::Hard => ReviewState {
            ease: (state.ease - 0.15).max(MIN_EASE),
            interval_days: if state.interval_days <= 1 {
                1
            } else {
                ((state.interval_days as f64) * 1.2).round().max(1.0) as i64
            },
        },
        Grade::Good => ReviewState {
            ease: state.ease,
            interval_days: match state.interval_days {
                0 => 1,
                1 => 6,
                n => ((n as f64) * state.ease).round().max(1.0) as i64,
            },
        },
        Grade::Easy => ReviewState {
            ease: state.ease + 0.15,
            interval_days: match state.interval_days {
                0 => 4,
                n => ((n as f64) * state.ease * 1.3).round().max(1.0) as i64,
            },
        },
    }
}

pub fn next_review_date(today: NaiveDate, interval_days: i64) -> NaiveDate {
    today + chrono::Duration::days(interval_days.max(1))
}

#[cfg(test)]
mod tests {
    use super::{apply_grade, next_review_date, Grade, ReviewState};
    use chrono::NaiveDate;

    #[test]
    fn good_at_interval_one_becomes_six() {
        let next = apply_grade(
            ReviewState {
                ease: 2.5,
                interval_days: 1,
            },
            Grade::Good,
        );
        assert_eq!(next.interval_days, 6);
        let today = NaiveDate::from_ymd_opt(2026, 10, 13).unwrap();
        assert_eq!(
            next_review_date(today, next.interval_days),
            NaiveDate::from_ymd_opt(2026, 10, 19).unwrap()
        );
    }
}
