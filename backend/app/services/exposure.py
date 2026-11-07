"""Load a public outlook for one coarse region. A failed source becomes a labeled sample."""

import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.core.config import Settings
from app.exposure.cache import ExposureCache
from app.exposure.parse import (
    BERLIN,
    DocumentError,
    PlaceMissing,
    is_stale,
    parse_air,
    parse_heat,
    parse_pollen,
    parse_uv,
    read_air_slots,
)
from app.exposure.regions import REGIONS, Region, region_label
from app.exposure.sample import synthetic_report, synthetic_topic
from app.schemas.exposure import ExposureFact, ExposureReport, ExposureTopic, Reason, SourceId, TopicName

logger = logging.getLogger("openkita.exposure")

_DWD_TTL = timedelta(hours=3)
_UBA_TTL = timedelta(hours=1)
_USER_AGENT = "OpenKitaAI/exposure"
CityParser = Callable[[dict[str, Any], str], tuple[datetime | None, list[ExposureFact]]]


class SourceUnreachable(Exception):
    pass


def _live_topic(
    *,
    topic: TopicName,
    source_id: SourceId,
    licence: str,
    dataset_url: str,
    retrieved_at: datetime,
    source_timestamp: datetime | None,
    now: datetime,
    place_label: str,
    facts: list[ExposureFact],
) -> ExposureTopic:
    return ExposureTopic(
        topic=topic,
        source_id=source_id,
        origin="live",
        licence=licence,
        dataset_url=dataset_url,
        retrieved_at=retrieved_at,
        source_timestamp=source_timestamp,
        stale=is_stale(source_timestamp, now),
        place_label=place_label,
        reason="none",
        sample_label_de=None,
        sample_label_en=None,
        facts=facts,
    )


async def _fetch_json(client: httpx.AsyncClient, url: str, source: str) -> dict[str, Any]:
    try:
        response = await client.get(
            url,
            headers={"accept": "application/json", "user-agent": _USER_AGENT},
        )
    except httpx.HTTPError as exc:
        logger.info("exposure_fetch source=%s status=error error=%s", source, type(exc).__name__)
        raise SourceUnreachable from None
    logger.info("exposure_fetch source=%s status=%s", source, response.status_code)
    if response.status_code != 200:
        raise SourceUnreachable
    try:
        payload: object = response.json()
    except ValueError:
        raise DocumentError from None
    if not isinstance(payload, dict):
        raise DocumentError
    return payload


async def _document(
    client: httpx.AsyncClient,
    cache: ExposureCache,
    *,
    key: str,
    url: str,
    source: str,
    ttl: timedelta,
    now: datetime,
) -> tuple[datetime, dict[str, Any]]:
    cached = await cache.get(key, now, ttl)
    if cached is not None:
        return cached.retrieved_at, cached.body
    body = await _fetch_json(client, url, source)
    await cache.put(key, body, now)
    return now, body


def _dwd_url(settings: Settings, name: str) -> str:
    return f"{settings.dwd_health_alerts_base_url}/{name}"


async def _dwd_city_topic(
    client: httpx.AsyncClient,
    cache: ExposureCache,
    settings: Settings,
    *,
    now: datetime,
    topic: TopicName,
    source_id: SourceId,
    filename: str,
    place: str | None,
    parse: CityParser,
) -> ExposureTopic:
    dataset_url = _dwd_url(settings, filename)
    if place is None:
        return synthetic_topic(topic, source_id, dataset_url, "CC BY 4.0", "no_published_place")
    try:
        retrieved_at, body = await _document(
            client,
            cache,
            key=f"dwd:{filename}",
            url=dataset_url,
            source=source_id,
            ttl=_DWD_TTL,
            now=now,
        )
        source_timestamp, facts = parse(body, place)
    except SourceUnreachable:
        return synthetic_topic(topic, source_id, dataset_url, "CC BY 4.0", "source_unreachable")
    except PlaceMissing:
        return synthetic_topic(topic, source_id, dataset_url, "CC BY 4.0", "no_published_place")
    except DocumentError:
        return synthetic_topic(topic, source_id, dataset_url, "CC BY 4.0", "unexpected_document")
    return _live_topic(
        topic=topic,
        source_id=source_id,
        licence="CC BY 4.0",
        dataset_url=dataset_url,
        retrieved_at=retrieved_at,
        source_timestamp=source_timestamp,
        now=now,
        place_label=place,
        facts=facts,
    )


async def _pollen_topic(
    client: httpx.AsyncClient,
    cache: ExposureCache,
    settings: Settings,
    region: Region,
    now: datetime,
) -> ExposureTopic:
    dataset_url = _dwd_url(settings, "s31fg.json")
    try:
        retrieved_at, body = await _document(
            client,
            cache,
            key="dwd:s31fg.json",
            url=dataset_url,
            source="dwd_pollen",
            ttl=_DWD_TTL,
            now=now,
        )
        source_timestamp, facts = parse_pollen(
            body,
            region_id=region.pollen_region_id,
            partregion_id=region.pollen_partregion_id,
        )
    except SourceUnreachable:
        return synthetic_topic("pollen", "dwd_pollen", dataset_url, "CC BY 4.0", "source_unreachable")
    except PlaceMissing:
        return synthetic_topic("pollen", "dwd_pollen", dataset_url, "CC BY 4.0", "no_published_place")
    except DocumentError:
        return synthetic_topic("pollen", "dwd_pollen", dataset_url, "CC BY 4.0", "unexpected_document")
    return _live_topic(
        topic="pollen",
        source_id="dwd_pollen",
        licence="CC BY 4.0",
        dataset_url=dataset_url,
        retrieved_at=retrieved_at,
        source_timestamp=source_timestamp,
        now=now,
        place_label=region.label,
        facts=facts,
    )


def _air_url(settings: Settings, station: str, day: str, *, forecast: bool) -> str:
    base = settings.uba_air_base_url
    if forecast:
        return f"{base}/airqualityforecast/json?station={station}"
    return (
        f"{base}/airquality/json?station={station}"
        f"&date_from={day}&date_to={day}&time_from=1&time_to=24&lang=de"
    )


async def _air_half(
    client: httpx.AsyncClient,
    cache: ExposureCache,
    settings: Settings,
    *,
    station: str,
    now: datetime,
    forecast: bool,
) -> tuple[str, list[tuple[datetime, int]] | None]:
    day = now.astimezone(BERLIN).date().isoformat()
    url = _air_url(settings, station, day, forecast=forecast)
    source = "uba_air_forecast" if forecast else "uba_air"
    try:
        _retrieved_at, body = await _document(
            client,
            cache,
            key=f"{source}:{station}:{day}",
            url=url,
            source=source,
            ttl=_UBA_TTL,
            now=now,
        )
    except SourceUnreachable:
        return "unreachable", None
    except DocumentError:
        return "unexpected", None
    try:
        return "ok", read_air_slots(body, forecast=forecast)
    except DocumentError:
        return "unexpected", None


async def _air_topic(
    client: httpx.AsyncClient,
    cache: ExposureCache,
    settings: Settings,
    region: Region,
    now: datetime,
) -> ExposureTopic:
    dataset_url = f"{settings.uba_air_base_url}/doc"
    station = region.air_station
    if station is None or not station.isalnum():
        return synthetic_topic("air", "uba_air", dataset_url, "dl-de/by-2-0", "no_published_place")
    measured_pair, forecast_pair = await asyncio.gather(
        _air_half(client, cache, settings, station=station, now=now, forecast=False),
        _air_half(client, cache, settings, station=station, now=now, forecast=True),
    )
    measured_state, measured = measured_pair
    forecast_state, forecast = forecast_pair
    if measured is None and forecast is None:
        reason: Reason = "unexpected_document"
        if measured_state == "unreachable" or forecast_state == "unreachable":
            reason = "source_unreachable"
        return synthetic_topic("air", "uba_air", dataset_url, "dl-de/by-2-0", reason)
    try:
        source_timestamp, facts = parse_air(measured, forecast, today=now)
    except DocumentError:
        return synthetic_topic("air", "uba_air", dataset_url, "dl-de/by-2-0", "unexpected_document")
    place = region.uv_city or region.heat_city or region.label
    return _live_topic(
        topic="air",
        source_id="uba_air",
        licence="dl-de/by-2-0",
        dataset_url=dataset_url,
        retrieved_at=now,
        source_timestamp=source_timestamp,
        now=now,
        place_label=place,
        facts=facts,
    )


async def load_exposure(
    *,
    region_code: str | None,
    client: httpx.AsyncClient,
    cache: ExposureCache,
    settings: Settings,
    now: datetime | None = None,
) -> ExposureReport:
    """Public outlook. Requests carry the coarse region only, never a facility id."""
    moment = now or datetime.now(UTC)
    if not region_code:
        return synthetic_report(region_code=None, region_label=None, reason="region_missing")
    region = REGIONS.get(region_code)
    if region is None:
        return synthetic_report(
            region_code=region_code,
            region_label=region_label(region_code),
            reason="no_published_place",
        )
    heat, uv, pollen, air = await asyncio.gather(
        _dwd_city_topic(
            client,
            cache,
            settings,
            now=moment,
            topic="heat",
            source_id="dwd_heat",
            filename="gt.json",
            place=region.heat_city,
            parse=parse_heat,
        ),
        _dwd_city_topic(
            client,
            cache,
            settings,
            now=moment,
            topic="uv",
            source_id="dwd_uv",
            filename="uvi.json",
            place=region.uv_city,
            parse=parse_uv,
        ),
        _pollen_topic(client, cache, settings, region, moment),
        _air_topic(client, cache, settings, region, moment),
    )
    return ExposureReport(
        region_set=True,
        region_code=region.code,
        region_label=region.label,
        topics=[heat, uv, pollen, air],
    )

