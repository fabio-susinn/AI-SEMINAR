def float_hours_to_hhmm(arrival_h: float) -> str:
    """Converts a float hour (e.g., 11.48) to a 'HH:MM' string format."""
    hours = int(arrival_h)
    minutes = int(round((arrival_h - hours) * 60))
    if minutes == 60:
        hours += 1
        minutes = 0
    return f"{hours:02d}:{minutes:02d}"