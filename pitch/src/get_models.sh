#!/usr/bin/env bash
# Download the Kokoro-82M ONNX weights + voice pack (~350 MB, git-ignored) into pitch/models/ and verify checksums.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p models
BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [ -f "models/$f" ] || curl -L -o "models/$f" "$BASE/$f"
done
(cd models && if command -v sha256sum >/dev/null; then sha256sum -c ../src/models.sha256; else shasum -a 256 -c ../src/models.sha256; fi)
