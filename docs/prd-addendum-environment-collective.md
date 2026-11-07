# PRD Addendum: Public environment data and later aggregate illness signals

Status: Draft · Applies to: **v0.4** (public data only) and **not before v1.0** (aggregate illness) ·
Related: [PRD.md](PRD.md) §7, [privacy.md](privacy.md), ADR 0003

This addendum specifies two **separate** ideas. Only the first has a version. Neither is part of
v0.1, and this document does not authorise implementation by itself.

Terms: *MUST/MUST NOT/SHOULD/MAY* as in RFC 2119.

---

## 1. What this is

OpenKita may later help staff **draft** parent letters about conditions outside the facility:
weather, air quality, and public infectious-disease situation reports. The assistant still only
writes drafts. A person approves. Nothing is sent to parents.

It is not a health-record system, not a child profile, and not a Kita management feature.

## 2. v0.4 — public environment data

### 2.1 Goal

Let an educator, while drafting a parent letter, optionally insert **public** facts such as a heat
warning, an air-quality notice, or a link to a public health-authority situation report. The facts
are inputs to the parent-communication draft. They are not decisions about children or staff.

### 2.2 Sources

Three public authorities are in scope. **No API endpoint, dataset URL, query parameter, or licence
term below has been verified for this project.** Implementation MUST start by confirming the
current access method, licence, and attribution rules on the authority's own site. Until that
check is written down, every source stays **to be verified**, and no client may call a guessed URL.

| Authority | Intended public data | Status |
|---|---|---|
| Deutscher Wetterdienst (DWD) | Weather warnings and forecasts relevant to outdoor time at the facility | Endpoints, dataset names, and licence: **to be verified** at the DWD open-data offering |
| Umweltbundesamt (UBA) | Public air-quality information (for example ozone or particulate-matter notices) | API or download URLs and licence: **to be verified** at the UBA air-quality offering |
| Robert Koch-Institut (RKI) | Public, population-level infectious-disease situation reports | Access method and licence: **to be verified** at the RKI open-data offering |

Organisation homepages (not APIs): [dwd.de](https://www.dwd.de/),
[umweltbundesamt.de](https://www.umweltbundesamt.de/), [rki.de](https://www.rki.de/).

Out of scope for v0.4: commercial weather APIs, unofficial scrapers, and any feed that requires an
account or an API key. If a verified source later requires a key, that key is configuration, is
never logged, and the feature stays optional. A missing key disables only that source.

### 2.3 Data rules

- Only data the authority publishes for the general public. No child, parent, or staff data is
  sent to these sources. Requests contain a place (municipality, district, or station id the
  facility configured), a time window, and nothing else.
- The facility configures its own place once. There is still one facility per deployment
  (ADR 0004). The place is not a child address.
- Responses are cached on the host. Cache duration follows the source's update rhythm once that
  rhythm is verified; until then, do not poll faster than the published guidance, and do not poll
  at all if the guidance is unknown.
- Each fact shown in the UI names the authority, the retrieval time, and that the text is a public
  report, not a Kita policy. The draft MUST NOT present the figure as medical advice or as an
  instruction the facility has already carried out.
- If a source is unreachable, times out, or returns an unexpected document, the draft flow
  continues **without** that fact and says the source was unavailable. It MUST NOT invent a
  warning, a measurement, or a citation.
- Attribution required by the verified licence is shown with the fact.

### 2.4 Product boundaries

- Staff choose whether to include a retrieved fact in a letter. Inclusion is editing the draft,
  not an automatic letter.
- No child profiles. No "which children are affected". No attendance, absence, or symptom fields.
- German UI strings go through the i18n catalogs. The feature does not exist until its version;
  the UI MUST NOT show a control that pretends to load weather or air data before then.

### 2.5 Not in this version of the software

v0.1 does not call DWD, UBA, or RKI. There is no client, no cache table, and no environment-data
screen.

---

## 3. Aggregate illness signals — not before v1.0

This section is a **later design**, recorded so it is not confused with the public RKI reports in
§2. It is **not** a v0.4 feature. It MUST NOT be implemented before v1.0, and it MUST NOT be
implemented at all until a written legal review says it may be built. That review is a gate, not
a formality: if the review says no, the feature is dropped.

### 3.1 Idea

A facility might optionally count, for its own planning, how many children were reported absent
with a contagious illness in a week — as a single number, with no names. A Träger might later
want to compare those counts across facilities. That is processing of health-related information,
even when it is aggregated.

### 3.2 Gate

Before any design is turned into code, schema, or UI:

1. A legal review (GDPR, including whether the counts are special-category data under Art. 9 or
   become identifiable when the group is small) MUST be completed and stored with the decision.
2. The review MUST name the legal basis, who is controller, the retention period, and whether
   small counts have to be suppressed (for example fewer than a stated threshold shown only as
   "below threshold").
3. The feature stays **off** unless an administrator opts in after reading that decision. Default
   is off. Opt-in is per deployment, never on by default.
4. No individual child, parent, or staff identifier is stored. No symptoms tied to a person. No
   automated decision about a child or an employee. This does not add child profiles.
5. Counts MUST NOT leave the host (no external AI, no MCP, no central OpenKita service). A future
   multi-facility comparison, if the review allows it at all, is a separate decision.
6. If the review, the opt-in flag, or the threshold check fails or is missing, the feature
   refuses to record or display a count (fail closed).

### 3.3 Explicitly deferred

No table, endpoint, screen, or export for facility illness counts exists in v0.1–v0.4. Public RKI
situation reports (§2) are not a substitute and MUST NOT be filled with facility counts.

---

## 4. Privacy summary

| Data | Version | Leaves the host? |
|---|---|---|
| Public DWD / UBA / RKI documents | v0.4, after endpoints are verified | Only the public request (place and time) goes to that authority. No Kita documents and no personal data. |
| Facility illness aggregates | Not before v1.0, and only after legal review and opt-in | No |

External AI stays behind the Privacy Gateway (ADR 0003). This addendum does not weaken that rule.
