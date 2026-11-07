"""Exposure outlook: live public readings stay, everything else is a labeled sample."""

from datetime import UTC, datetime
from typing import Any

import httpx
from httpx import AsyncClient

from app.api.deps import get_exposure_client
from app.exposure.cache import ExposureCache
from app.exposure.parse import parse_air, parse_pollen, read_air_slots
from app.exposure.sample import SAMPLE_AREA, SAMPLE_LABEL_DE, SAMPLE_LABEL_EN
from app.schemas.exposure import ExposureReport
from app.services.exposure import load_exposure
from tests.conftest import make_settings

NOW = datetime(2026, 11, 7, 12, 0, tzinfo=UTC)
GOOD_PASSWORD = "Beispiel-Passwort-12"
EDUCATOR_PASSWORD = "Fachkraft-Beispiel-12"
_CHILD_KEYS = {
    "child",
    "children",
    "kid",
    "staff",
    "symptom",
    "symptoms",
    "illness",
    "krankheit",
    "kind",
    "kinder",
}


def _pollen(
    region_id: int,
    partregion_id: int,
    *,
    birch_today: str,
    updated: str,
) -> dict[str, Any]:
    pollen = {
        name: {"today": "0", "tomorrow": "0", "dayafter_to": "0"}
        for name in ("Hasel", "Erle", "Esche", "Birke", "Graeser", "Roggen", "Beifuss", "Ambrosia")
    }
    pollen["Birke"] = {"today": birch_today, "tomorrow": "1", "dayafter_to": "0"}
    return {
        "last_update": updated,
        "legend": {
            "id1": "0",
            "id1_desc": "keine Belastung",
            "id7": "3",
            "id7_desc": "hohe Belastung",
        },
        "content": [
            {
                "region_id": region_id,
                "partregion_id": partregion_id,
                "Pollen": pollen,
            }
        ],
    }


def _live_documents(*, pollen_updated: str = "2026-11-07 11:00 Uhr") -> dict[str, Any]:
    return {
        "pollen": _pollen(50, -1, birch_today="3", updated=pollen_updated),
        "uv": {
            "last_update": "2026-11-07T07:30:00",
            "content": [
                {"city": "Berlin", "forecast": {"today": 7, "tomorrow": 6, "dayafter_to": 4}},
                {"city": "Hamburg", "forecast": {"today": 1, "tomorrow": 1, "dayafter_to": 1}},
            ],
        },
        "heat": {
            "last_update": "2026-11-07T07:30:00",
            "content": [
                {
                    "city": "Berlin",
                    "forecast": {
                        "today_09MEZ": "keine",
                        "today_15MEZ": "gering",
                        "today_21MEZ": "keine",
                        "tomorrow_15MEZ": "keine",
                        "dayafter_to_15MEZ": "gering",
                    },
                }
            ],
        },
        "air": {
            "data": {
                "10": {
                    "2026-11-07 10:00:00": ["2026-11-07 11:00:00", 1, 0],
                    "2026-11-07 11:00:00": ["2026-11-07 12:00:00", 2, 0],
                }
            }
        },
        "forecast": {
            "data": {
                "10": {
                    "2026-11-08 09:00:00": ["2026-11-08 10:00:00", "2026-11-07 08:00:00", 1, 0],
                    "2026-11-08 15:00:00": ["2026-11-08 16:00:00", "2026-11-07 08:00:00", 3, 0],
                }
            }
        },
    }


def _client(
    documents: dict[str, Any] | None,
    calls: list[str],
    *,
    status: int = 200,
) -> AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        if status != 200 or documents is None:
            return httpx.Response(status)
        path = request.url.path
        if path.endswith("/s31fg.json"):
            return httpx.Response(200, json=documents["pollen"])
        if path.endswith("/uvi.json"):
            return httpx.Response(200, json=documents["uv"])
        if path.endswith("/gt.json"):
            return httpx.Response(200, json=documents["heat"])
        if path.endswith("/airquality/json"):
            return httpx.Response(200, json=documents["air"])
        if path.endswith("/airqualityforecast/json"):
            return httpx.Response(200, json=documents["forecast"])
        return httpx.Response(404)

    return AsyncClient(transport=httpx.MockTransport(handler))


async def _load(client: AsyncClient, region: str | None) -> ExposureReport:
    return await load_exposure(
        region_code=region,
        client=client,
        cache=ExposureCache(),
        settings=make_settings(),
        now=NOW,
    )


def _topic(report: ExposureReport, name: str) -> Any:
    return next(topic for topic in report.topics if topic.topic == name)


def _walk(value: object) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            assert key.lower() not in _CHILD_KEYS
            _walk(item)
    elif isinstance(value, list):
        for item in value:
            _walk(item)


async def test_no_region_is_synthetic_and_does_not_call_sources() -> None:
    calls: list[str] = []
    client = _client(None, calls, status=500)
    report = await _load(client, None)
    assert calls == []
    assert report.region_set is False
    assert report.topics
    for topic in report.topics:
        assert topic.origin == "synthetic"
        assert topic.reason == "region_missing"
        assert topic.place_label == SAMPLE_AREA
        assert topic.sample_label_de == SAMPLE_LABEL_DE
        assert topic.sample_label_en == SAMPLE_LABEL_EN
        assert topic.facts[0].code.startswith("sample_")
    _walk(report.model_dump(mode="json"))


async def test_source_failure_uses_the_labeled_sample() -> None:
    calls: list[str] = []
    client = _client(None, calls, status=503)
    report = await _load(client, "50")
    assert calls
    assert report.region_set is True
    assert report.region_label == "Brandenburg und Berlin"
    for topic in report.topics:
        assert topic.origin == "synthetic"
        assert topic.reason == "source_unreachable"
        assert topic.sample_label_de == SAMPLE_LABEL_DE
        assert all(not fact.code.isdigit() for fact in topic.facts)
        assert topic.place_label == SAMPLE_AREA


async def test_successful_live_reading_is_not_replaced() -> None:
    calls: list[str] = []
    documents = _live_documents()
    client = _client(documents, calls)
    report = await _load(client, "50")
    uv = _topic(report, "uv")
    pollen = _topic(report, "pollen")
    heat = _topic(report, "heat")
    air = _topic(report, "air")
    assert uv.origin == "live"
    assert uv.sample_label_de is None
    assert uv.place_label == "Berlin"
    assert [fact.code for fact in uv.facts] == ["7", "6", "4"]
    assert pollen.origin == "live"
    assert pollen.facts[0].subject == "Birke"
    assert pollen.facts[0].code == "3"
    assert heat.origin == "live"
    assert heat.facts[0].code == "gering"
    assert air.origin == "live"
    assert [fact.code for fact in air.facts] == ["2", "3"]
    dumped = report.model_dump(mode="json")
    assert SAMPLE_LABEL_DE not in str(dumped)
    assert "sample_uv" not in str(dumped)
    for url in calls:
        assert url.startswith("https://opendata.dwd.de/") or url.startswith(
            "https://luftdaten.umweltbundesamt.de/"
        )
        assert "facility" not in url
        assert "Sonnenblume" not in url
    assert any("station=DEBE010" in url for url in calls)


async def test_stale_timestamp_keeps_the_live_value() -> None:
    calls: list[str] = []
    documents = _live_documents(pollen_updated="2020-01-02 11:00 Uhr")
    report = await _load(_client(documents, calls), "50")
    pollen = _topic(report, "pollen")
    assert pollen.origin == "live"
    assert pollen.stale is True
    assert pollen.facts[0].code == "3"
    assert pollen.sample_label_de is None
    assert _topic(report, "uv").stale is False


async def test_fixture_forecast_mapping() -> None:
    document = _pollen(50, -1, birch_today="3", updated="2026-11-07 11:00 Uhr")
    _stamp, facts = parse_pollen(document, region_id=50, partregion_id=-1)
    by_day = {fact.day: fact for fact in facts}
    assert by_day["today"].subject == "Birke"
    assert by_day["today"].code == "3"
    assert by_day["tomorrow"].code == "1"
    assert by_day["day_after"].code == "0"
    assert by_day["day_after"].subject is None
    measured = read_air_slots(_live_documents()["air"], forecast=False)
    forecast = read_air_slots(_live_documents()["forecast"], forecast=True)
    _when, air_facts = parse_air(measured, forecast, today=NOW)
    assert [(fact.day, fact.code) for fact in air_facts] == [("today", "2"), ("tomorrow", "3")]


async def test_missing_published_place_does_not_borrow_another_city() -> None:
    calls: list[str] = []
    documents = _live_documents()
    documents["pollen"] = _pollen(40, 42, birch_today="2", updated="2026-11-07 11:00 Uhr")
    report = await _load(_client(documents, calls), "42")
    assert calls
    assert all(url.endswith("/s31fg.json") for url in calls)
    pollen = _topic(report, "pollen")
    assert pollen.origin == "live"
    assert pollen.facts[0].code == "2"
    uv = _topic(report, "uv")
    assert uv.origin == "synthetic"
    assert uv.reason == "no_published_place"
    assert uv.sample_label_en == SAMPLE_LABEL_EN
    assert all(fact.code != "7" for fact in uv.facts)


async def _setup(client: AsyncClient) -> None:
    response = await client.post(
        "/setup",
        json={
            "facility_name": "Kita Sonnenblume",
            "email": "leitung@kita-sonnenblume.example",
            "display_name": "Frau Beispiel",
            "password": GOOD_PASSWORD,
        },
    )
    assert response.status_code == 201, response.text


async def test_educator_cannot_change_region_and_response_has_no_child_fields(api: Any) -> None:
    client, _factory, app = api
    await _setup(client)
    missing = await client.get("/exposure")
    assert missing.status_code == 200
    body = missing.json()
    assert body["region_set"] is False
    assert body["topics"][0]["sample_label_de"] == SAMPLE_LABEL_DE
    _walk(body)

    created = await client.post(
        "/users",
        json={
            "email": "fachkraft@kita-sonnenblume.example",
            "display_name": "Herr Muster",
            "password": EDUCATOR_PASSWORD,
        },
    )
    assert created.status_code == 201, created.text
    saved = await client.patch("/facility/region", json={"region_code": "50"})
    assert saved.status_code == 200
    assert saved.json()["exposure_region_code"] == "50"
    assert saved.json()["exposure_region_label"] == "Brandenburg und Berlin"
    invalid = await client.patch("/facility/region", json={"region_code": "999"})
    assert invalid.status_code == 422
    assert invalid.json()["detail"] == "invalid_region"

    calls: list[str] = []
    mock = _client(_live_documents(), calls)
    app.dependency_overrides[get_exposure_client] = lambda: mock
    live = await client.get("/exposure")
    assert live.status_code == 200
    live_body = live.json()
    assert live_body["topics"][1]["origin"] == "live"
    assert live_body["topics"][1]["facts"][0]["code"] == "7"
    assert live_body["topics"][1]["sample_label_de"] is None
    _walk(live_body)
    await mock.aclose()

    await client.post("/auth/logout")
    educator = await client.post(
        "/auth/login",
        json={"email": "fachkraft@kita-sonnenblume.example", "password": EDUCATOR_PASSWORD},
    )
    assert educator.status_code == 200
    refused = await client.patch("/facility/region", json={"region_code": "12"})
    assert refused.status_code == 403
    assert refused.json()["detail"] == "forbidden"
    seen = await client.get("/facility")
    assert seen.json()["exposure_region_code"] == "50"
    readable = await client.get("/exposure/regions")
    assert readable.status_code == 200
    assert any(item["code"] == "50" for item in readable.json())
