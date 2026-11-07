# Third-party notices

OpenKita AI is licensed under the Apache License 2.0 (see `LICENSE`, `NOTICE`). It depends on
open-source packages that keep their own licences; they are installed from package registries
(`backend/uv.lock`, `frontend/package-lock.json`) and are not copied into this repository.
Run `pip-licenses` (backend) or `npx license-checker --summary` (frontend) for the full list.
At the time of the last review (v0.1) no GPL/AGPL dependency was found.

## Notable licences

| Component | Licence | Notes |
|---|---|---|
| `@img/sharp-libvips-*` (via `sharp`, an optional dependency of Next.js) | **LGPL-3.0-or-later** | Native libvips libraries used for Next.js image optimisation. They are **dynamically linked** shared libraries, unmodified, obtained from npm; OpenKita AI code is not derived from them. If you redistribute the frontend Docker image you also distribute these libraries: keep their licence notices (shipped inside `node_modules/@img/sharp-libvips-*`) and offer the corresponding source on request (<https://github.com/lovell/sharp-libvips>). This app does not use `next/image`, so `sharp` can be removed from an image if you prefer (e.g. `npm_config_os`/omit optional, or `images.unoptimized`). |
| `lightningcss`, `axe-core` (dev/build), `certifi`, `pathspec` | MPL-2.0 | File-level copyleft; used unmodified. |
| `caniuse-lite` | CC-BY-4.0 | Browser-support data used by build tooling. |
| `argon2-cffi`, `jsonschema`, `python-docx`, `aiosqlite` | MIT | Password hashing, skill JSON validation, DOCX export. `aiosqlite` is the test database driver and is also present in `requirements.lock.txt` because CI exports the lock with the dev group. |
| `reportlab` | BSD | PDF export of a saved draft. |

## Container base images

`python`, `node`, `postgres` (pgvector image) and `ollama` images contain further packages under
their own licences (Debian/Alpine, PostgreSQL licence, MIT, etc.). Refer to the respective image
documentation when redistributing images.
