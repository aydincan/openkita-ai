"""Coarse public regions for environment readings.

Codes follow the DWD pollen areas in ``s31fg.json`` (region or part-region).
UV and heat cities are names that appear in the DWD ``uvi.json`` and ``gt.json``
files. Air stations are codes returned by the UBA stations list
(``use=airquality``, checked 2026-11-07); background stations where one was
active. A missing city or station means that source has no published place for
the area — the service must not borrow a neighbouring reading.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Region:
    code: str
    label: str
    pollen_region_id: int
    pollen_partregion_id: int
    uv_city: str | None
    heat_city: str | None
    air_station: str | None


REGIONS: dict[str, Region] = {
    item.code: item
    for item in (
        Region(
            "11",
            "Schleswig-Holstein und Hamburg – Inseln und Marschen",
            10,
            11,
            "List auf Sylt",
            "List",
            None,
        ),
        Region(
            "12",
            "Schleswig-Holstein und Hamburg – Geest",
            10,
            12,
            "Kiel",
            "Kiel",
            "DESH057",
        ),
        Region("20", "Mecklenburg-Vorpommern", 20, -1, "Rostock", "Rostock", "DEMV022"),
        Region(
            "31",
            "Niedersachsen und Bremen – Westliches Niedersachsen und Bremen",
            30,
            31,
            "Bremen",
            "Bremen",
            "DEHB001",
        ),
        Region(
            "32",
            "Niedersachsen und Bremen – Östliches Niedersachsen",
            30,
            32,
            "Hannover",
            "Hannover",
            "DENI054",
        ),
        Region(
            "41",
            "Nordrhein-Westfalen – Rheinisch-Westfälisches Tiefland",
            40,
            41,
            "Düsseldorf",
            "Düsseldorf",
            "DENW071",
        ),
        Region("42", "Nordrhein-Westfalen – Ostwestfalen", 40, 42, None, None, None),
        Region(
            "43",
            "Nordrhein-Westfalen – Mittelgebirge",
            40,
            43,
            "Kahler Asten",
            None,
            None,
        ),
        Region("50", "Brandenburg und Berlin", 50, -1, "Berlin", "Berlin", "DEBE010"),
        Region("61", "Sachsen-Anhalt – Tiefland", 60, 61, "Magdeburg", "Magdeburg", "DEST077"),
        Region("62", "Sachsen-Anhalt – Harz", 60, 62, "Wernigerode", "Wernigerode", "DEST011"),
        Region("71", "Thüringen – Tiefland", 70, 71, "Weimar", "Weimar", "DETH093"),
        Region("72", "Thüringen – Mittelgebirge", 70, 72, None, None, None),
        Region("81", "Sachsen – Tiefland", 80, 81, "Dresden", "Dresden", "DESN092"),
        Region("82", "Sachsen – Mittelgebirge", 80, 82, None, None, None),
        Region(
            "91",
            "Hessen – Nordhessen und hessisches Mittelgebirge",
            90,
            91,
            "Kassel",
            "Kassel",
            "DEHE013",
        ),
        Region("92", "Hessen – Rhein-Main", 90, 92, "Frankfurt/Main", "Frankfurt", "DEHE008"),
        Region(
            "101",
            "Rheinland-Pfalz und Saarland – Rhein, Pfalz, Nahe und Mosel",
            100,
            101,
            "Weinbiet",
            None,
            None,
        ),
        Region(
            "102",
            "Rheinland-Pfalz und Saarland – Mittelgebirge",
            100,
            102,
            None,
            None,
            None,
        ),
        Region("103", "Saarland", 100, 103, None, "Saarbrücken", "DESL011"),
        Region(
            "111",
            "Baden-Württemberg – Oberrhein und unteres Neckartal",
            110,
            111,
            "Freiburg",
            "Freiburg",
            "DEBW084",
        ),
        Region(
            "112",
            "Baden-Württemberg – Hohenlohe, mittlerer Neckar, Oberschwaben",
            110,
            112,
            "Stuttgart",
            "Stuttgart",
            "DEBW013",
        ),
        Region("113", "Baden-Württemberg – Mittelgebirge", 110, 113, None, None, None),
        Region(
            "121",
            "Bayern – Allgäu, Oberbayern, Bayerischer Wald",
            120,
            121,
            "München",
            "München",
            "DEBY039",
        ),
        Region("122", "Bayern – Donauniederungen", 120, 122, "Ulm", "Ulm", "DEBW019"),
        Region("123", "Bayern – nördlich der Donau", 120, 123, "Nürnberg", "Nürnberg", "DEBY120"),
        Region("124", "Bayern – Mainfranken", 120, 124, "Würzburg", "Würzburg", "DEBY077"),
    )
}


def region_label(code: str | None) -> str | None:
    if code is None:
        return None
    region = REGIONS.get(code)
    return None if region is None else region.label
