"""Public environment outlook. No child, parent, or staff fields."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TopicName = Literal["heat", "uv", "pollen", "air"]
SourceId = Literal["dwd_heat", "dwd_uv", "dwd_pollen", "uba_air"]
Origin = Literal["live", "synthetic"]
DayName = Literal["today", "tomorrow", "day_after"]
Reason = Literal[
    "none",
    "region_missing",
    "source_unreachable",
    "unexpected_document",
    "no_published_place",
]


class ExposureFact(BaseModel):
    day: DayName
    code: str = Field(max_length=40)
    subject: str | None = Field(default=None, max_length=40)


class ExposureTopic(BaseModel):
    topic: TopicName
    source_id: SourceId
    origin: Origin
    licence: str
    dataset_url: str
    retrieved_at: datetime | None
    source_timestamp: datetime | None
    stale: bool
    place_label: str
    reason: Reason
    sample_label_de: str | None
    sample_label_en: str | None
    facts: list[ExposureFact]


class ExposureReport(BaseModel):
    region_set: bool
    region_code: str | None
    region_label: str | None
    topics: list[ExposureTopic]


class ExposureRegionOption(BaseModel):
    code: str
    label: str
