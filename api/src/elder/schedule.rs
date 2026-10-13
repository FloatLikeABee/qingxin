use chrono::{DateTime, Datelike, Duration, FixedOffset, TimeZone, Utc};

use crate::error::AppError;

pub fn parse_hhmm(time: &str) -> Result<(u32, u32), AppError> {
    let Some((h, m)) = time.split_once(':') else {
        return Err(AppError::InvalidRequest(
            "time must be HH:MM and weekdays are required".into(),
        ));
    };
    let hour: u32 = h
        .parse()
        .map_err(|_| AppError::InvalidRequest("time must be HH:MM".into()))?;
    let minute: u32 = m
        .parse()
        .map_err(|_| AppError::InvalidRequest("time must be HH:MM".into()))?;
    if h.len() != 2 || m.len() != 2 || hour > 23 || minute > 59 {
        return Err(AppError::InvalidRequest("time must be HH:MM".into()));
    }
    Ok((hour, minute))
}

pub fn validate_days(days: &[u8]) -> Result<Vec<u8>, AppError> {
    if days.is_empty() {
        return Err(AppError::InvalidRequest(
            "days_of_week must be a non-empty list of 1-7".into(),
        ));
    }
    let mut out = Vec::new();
    for day in days {
        if !(1..=7).contains(day) {
            return Err(AppError::InvalidRequest(
                "days_of_week must be ISO weekdays 1-7".into(),
            ));
        }
        if !out.contains(day) {
            out.push(*day);
        }
    }
    Ok(out)
}

pub fn tz_offset(name: &str) -> FixedOffset {
    match name.trim() {
        "UTC" | "Etc/UTC" | "Z" => FixedOffset::east_opt(0).expect("zero offset"),
        _ => FixedOffset::east_opt(8 * 3600).expect("shanghai offset"),
    }
}

pub fn next_occurrence(
    time: &str,
    days: &[u8],
    tz_name: &str,
    from: DateTime<Utc>,
) -> Result<DateTime<Utc>, AppError> {
    let (hour, minute) = parse_hhmm(time)?;
    let days = validate_days(days)?;
    let offset = tz_offset(tz_name);
    let local = from.with_timezone(&offset);
    for add in 0..8 {
        let day = local.date_naive() + Duration::days(add);
        let weekday = day.weekday().number_from_monday() as u8;
        if !days.contains(&weekday) {
            continue;
        }
        let Some(naive) = day.and_hms_opt(hour, minute, 0) else {
            continue;
        };
        let Some(candidate) = offset.from_local_datetime(&naive).single() else {
            continue;
        };
        if candidate > local {
            return Ok(candidate.with_timezone(&Utc));
        }
    }
    Err(AppError::InvalidRequest(
        "could not compute next occurrence".into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::{next_occurrence, parse_hhmm, validate_days};
    use chrono::{TimeZone, Utc};

    #[test]
    fn rejects_cron_shaped_time() {
        assert!(parse_hhmm("0 8 * * *").is_err());
        assert!(validate_days(&[]).is_err());
    }

    #[test]
    fn next_weekday_morning_in_shanghai() {
        // 01:00Z is 09:00 in Shanghai, so 08:00 that Tuesday has passed.
        let from = Utc.with_ymd_and_hms(2026, 10, 13, 1, 0, 0).unwrap();
        let next = next_occurrence("08:00", &[1, 2, 3, 4, 5], "Asia/Shanghai", from).unwrap();
        assert_eq!(next, Utc.with_ymd_and_hms(2026, 10, 14, 0, 0, 0).unwrap());
    }
}
