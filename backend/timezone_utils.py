from datetime import datetime, timezone, timedelta

def get_utc_now() -> datetime:
    """Returns the current strict UTC datetime."""
    return datetime.now(timezone.utc)

def resolve_local_date_str(utc_dt: datetime, offset_minutes: int) -> str:
    """
    Given a UTC datetime and a user's local timezone offset (in minutes),
    returns the exact local date string (YYYY-MM-DD).
    This ensures midnight resets happen exactly at the user's local midnight.
    """
    # JS Date.getTimezoneOffset() returns minutes, usually negative for ahead of UTC (e.g. UTC+5:30 is -330)
    # So we invert the sign to get the true offset to add to UTC.
    offset_delta = timedelta(minutes=-offset_minutes)
    local_dt = utc_dt + offset_delta
    return local_dt.strftime("%Y-%m-%d")

def parse_local_date_str(date_str: str) -> datetime:
    """
    Parses a local date string (YYYY-MM-DD) into a naive datetime.
    """
    return datetime.strptime(date_str, "%Y-%m-%d")
