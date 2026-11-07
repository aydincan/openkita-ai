"""Map published DWD and UBA documents onto outlook facts. No network here."""

from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.schemas.exposure import ExposureFact

BERLIN = ZoneInfo("Europe/Berlin")
STALE_AFTER = timedelta(hours=36)

POLLEN_TYPES = ("Hasel", "Erle", "Esche", "Birke", "Graeser", "Roggen", "Beifuss", "Ambrosia")
_HEAT_DAYS = (
    ("today", ("today_09MEZ", "today_15MEZ", "today_21MEZ")),
    ("tomorrow", ("tomorrow_15MEZ",)),
    ("day_after", ("dayafter_to_15MEZ",)),
)
_HEAT_RANK = {"keine": 0, "gering": 1, "maessig": 2, "stark": 3, "extrem": 4}
_UV_DAYS = (("today", "today"), ("tomorrow", "tomorrow"), ("day_after", "dayafter_to"))
_POLLEN_DAYS = (("today", "today"), ("tomorrow", "tomorrow"), ("day_after", "dayafter_to"))


class DocumentError(Exception):
    """The body is not the document this parser knows."""


class PlaceMissing(Exception):
    """The document parsed, and it does not list this place."""


def is_stale(source_timestamp: datetime | None, now: datetime) -> bool:
    if source_timestamp is None:
        return True
    return now - source_timestamp > STALE_AFTER


def parse_public_time(value: object) -> datetime:
    if not isinstance(value, str):
        raise DocumentError
    text = value.strip()
    if text.endswith(" Uhr"):
        text = text[: -len(" Uhr")].strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            naive = datetime.strptime(text, fmt)
        except ValueError:
            continue
        return naive.replace(tzinfo=BERLIN).astimezone(UTC)
    raise DocumentError


def _content(document: dict[str, Any]) -> list[dict[str, Any]]:
    raw = document.get("content")
    if not isinstance(raw, list):
        raise DocumentError
    rows: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            raise DocumentError
        rows.append(item)
    return rows


def _timestamp(document: dict[str, Any]) -> datetime | None:
    if "last_update" not in document:
        return None
    return parse_public_time(document["last_update"])


def _city_row(document: dict[str, Any], city: str) -> dict[str, Any]:
    found: dict[str, Any] | None = None
    for row in _content(document):
        if row.get("city") == city:
            found = row
            break
    if found is None:
        raise PlaceMissing
    return found


def _heat_code(raw: object) -> str:
    if not isinstance(raw, str):
        raise DocumentError
    token = " ".join(raw.split())
    if not token or len(token) > 40:
        raise DocumentError
    folded = token.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    if folded in _HEAT_RANK:
        return "maessig" if folded == "maessig" else folded
    return f"published:{token}"


def parse_heat(document: dict[str, Any], city: str) -> tuple[datetime | None, list[ExposureFact]]:
    row = _city_row(document, city)
    forecast = row.get("forecast")
    if not isinstance(forecast, dict):
        raise DocumentError
    facts: list[ExposureFact] = []
    for day, keys in _HEAT_DAYS:
        present = [forecast[key] for key in keys if key in forecast]
        if not present:
            continue
        coded = [_heat_code(item) for item in present]
        known = [code for code in coded if code in _HEAT_RANK]
        if known:
            code = max(known, key=lambda item: _HEAT_RANK[item])
        else:
            code = coded[0]
        facts.append(ExposureFact(day=day, code=code, subject=None))
    if not facts:
        raise DocumentError
    return _timestamp(document), facts


def parse_uv(document: dict[str, Any], city: str) -> tuple[datetime | None, list[ExposureFact]]:
    row = _city_row(document, city)
    forecast = row.get("forecast")
    if not isinstance(forecast, dict):
        raise DocumentError
    facts: list[ExposureFact] = []
    for day, key in _UV_DAYS:
        if key not in forecast:
            continue
        value = forecast[key]
        if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 20:
            raise DocumentError
        facts.append(ExposureFact(day=day, code=str(value), subject=None))
    if not facts:
        raise DocumentError
    return _timestamp(document), facts


def _require_pollen_legend(document: dict[str, Any]) -> None:
    legend = document.get("legend")
    if not isinstance(legend, dict):
        raise DocumentError
    codes = {
        value
        for key, value in legend.items()
        if isinstance(key, str) and not key.endswith("_desc") and isinstance(value, str)
    }
    if "0" not in codes:
        raise DocumentError


def _pollen_row(document: dict[str, Any], region_id: int, partregion_id: int) -> dict[str, Any]:
    found: dict[str, Any] | None = None
    for row in _content(document):
        try:
            row_region = int(row["region_id"])
            row_part = int(row["partregion_id"])
        except (KeyError, TypeError, ValueError) as exc:
            raise DocumentError from exc
        if row_region == region_id and row_part == partregion_id:
            found = row
            break
    if found is None:
        raise PlaceMissing
    return found


def parse_pollen(
    document: dict[str, Any],
    *,
    region_id: int,
    partregion_id: int,
) -> tuple[datetime | None, list[ExposureFact]]:
    _require_pollen_legend(document)
    pollen = _pollen_row(document, region_id, partregion_id).get("Pollen")
    if not isinstance(pollen, dict):
        raise DocumentError
    facts: list[ExposureFact] = []
    for day, key in _POLLEN_DAYS:
        elevated: list[ExposureFact] = []
        saw_zero = False
        saw_any = False
        for name in POLLEN_TYPES:
            block = pollen.get(name)
            if not isinstance(block, dict) or key not in block:
                continue
            raw = block[key]
            if isinstance(raw, bool) or not isinstance(raw, (str, int)):
                raise DocumentError
            code = str(raw).strip()
            if code in {"", "-1"}:
                continue
            if len(code) > 40:
                raise DocumentError
            saw_any = True
            if code == "0":
                saw_zero = True
                continue
            elevated.append(ExposureFact(day=day, code=code, subject=name))
        if elevated:
            facts.extend(elevated)
        elif saw_zero:
            facts.append(ExposureFact(day=day, code="0", subject=None))
        elif not saw_any:
            continue
    if not facts:
        raise DocumentError
    return _timestamp(document), facts


def read_air_slots(document: dict[str, Any], *, forecast: bool) -> list[tuple[datetime, int]]:
    data = document.get("data")
    if not isinstance(data, dict):
        raise DocumentError
    index_at = 2 if forecast else 1
    slots: list[tuple[datetime, int]] = []
    for station_rows in data.values():
        if not isinstance(station_rows, dict):
            raise DocumentError
        for start, row in station_rows.items():
            if not isinstance(row, list) or len(row) <= index_at:
                raise DocumentError
            index = row[index_at]
            if isinstance(index, bool) or not isinstance(index, int) or not 0 <= index <= 5:
                raise DocumentError
            slots.append((parse_public_time(start), index))
    return slots


def parse_air(
    measured_slots: list[tuple[datetime, int]] | None,
    forecast_slots: list[tuple[datetime, int]] | None,
    *,
    today: datetime,
) -> tuple[datetime | None, list[ExposureFact]]:
    if measured_slots is None and forecast_slots is None:
        raise DocumentError
    measured = measured_slots or []
    forecast = forecast_slots or []
    day = today.astimezone(BERLIN).date()

    def on(slots: list[tuple[datetime, int]], offset: int) -> list[tuple[datetime, int]]:
        target = day + timedelta(days=offset)
        return [(stamp, index) for stamp, index in slots if stamp.astimezone(BERLIN).date() == target]

    def latest(slots: list[tuple[datetime, int]]) -> str | None:
        usable = [(stamp, index) for stamp, index in slots if 0 <= index <= 4]
        if usable:
            usable.sort(key=lambda item: item[0])
            return str(usable[-1][1])
        if slots:
            return "no_data"
        return None

    def peak(slots: list[tuple[datetime, int]]) -> str | None:
        usable = [index for _, index in slots if 0 <= index <= 4]
        if usable:
            return str(max(usable))
        if slots:
            return "no_data"
        return None

    today_code = latest(measured) if measured else latest(on(forecast, 0))
    tomorrow_code = peak(on(forecast, 1))
    later_code = peak(on(forecast, 2))
    facts: list[ExposureFact] = []
    if today_code is not None:
        facts.append(ExposureFact(day="today", code=today_code, subject=None))
    if tomorrow_code is not None:
        facts.append(ExposureFact(day="tomorrow", code=tomorrow_code, subject=None))
    if later_code is not None:
        facts.append(ExposureFact(day="day_after", code=later_code, subject=None))
    if not facts:
        facts.append(ExposureFact(day="today", code="no_data", subject=None))
    stamps = [stamp for stamp, _ in measured] or [stamp for stamp, _ in forecast]
    source_timestamp = max(stamps) if stamps else None
    return source_timestamp, facts
