"""Fixed fictional outlook used when a live public reading is not available.

The numbers are examples for a made-up area. They are not measurements and not
warnings that were issued.
"""

from app.schemas.exposure import (
    ExposureFact,
    ExposureReport,
    ExposureTopic,
    Reason,
    SourceId,
    TopicName,
)

SAMPLE_AREA = "Beispielgebiet Nordlicht"
SAMPLE_LABEL_DE = "Beispieldaten, nicht live"
SAMPLE_LABEL_EN = "Sample data, not live"

_TOPICS: tuple[tuple[TopicName, SourceId, str, str], ...] = (
    (
        "heat",
        "dwd_heat",
        "https://opendata.dwd.de/climate_environment/health/alerts/gt.json",
        "CC BY 4.0",
    ),
    (
        "uv",
        "dwd_uv",
        "https://opendata.dwd.de/climate_environment/health/alerts/uvi.json",
        "CC BY 4.0",
    ),
    (
        "pollen",
        "dwd_pollen",
        "https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json",
        "CC BY 4.0",
    ),
    ("air", "uba_air", "https://luftdaten.umweltbundesamt.de/api/air-data/v4/doc", "dl-de/by-2-0"),
)


def synthetic_topic(
    topic: TopicName,
    source_id: SourceId,
    dataset_url: str,
    licence: str,
    reason: Reason,
) -> ExposureTopic:
    return ExposureTopic(
        topic=topic,
        source_id=source_id,
        origin="synthetic",
        licence=licence,
        dataset_url=dataset_url,
        retrieved_at=None,
        source_timestamp=None,
        stale=False,
        place_label=SAMPLE_AREA,
        reason=reason,
        sample_label_de=SAMPLE_LABEL_DE,
        sample_label_en=SAMPLE_LABEL_EN,
        facts=[
            ExposureFact(day="today", code=f"sample_{topic}", subject=None),
            ExposureFact(day="tomorrow", code=f"sample_{topic}", subject=None),
        ],
    )


def synthetic_report(
    *,
    region_code: str | None,
    region_label: str | None,
    reason: Reason,
) -> ExposureReport:
    return ExposureReport(
        region_set=region_code is not None,
        region_code=region_code,
        region_label=region_label,
        topics=[
            synthetic_topic(topic, source_id, url, licence, reason)
            for topic, source_id, url, licence in _TOPICS
        ],
    )
