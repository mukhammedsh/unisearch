#!/bin/bash -eu
# ClusterFuzzLite build script for UniSearch.
# Installs backend dependencies and packages Python fuzz targets into $OUT using compile_python_fuzzer.

# Ensure backend directory is in PYTHONPATH so PyInstaller bundles backend/app into fuzz targets
export PYTHONPATH="$SRC/unisearch/backend:${PYTHONPATH:-}"

# Install dependencies required by backend services using pinned versions
grep -vE "^(torch|sentence-transformers)" backend/requirements.txt > /tmp/requirements-fuzz.txt
python3 -m pip install --no-cache-dir -r /tmp/requirements-fuzz.txt

# Pre-compile Python bytecode
python3 -m compileall -q backend/app

# Package all fuzz targets using OSS-Fuzz/ClusterFuzzLite compiler
for fuzzer in $SRC/unisearch/.clusterfuzzlite/fuzz_targets/fuzz_*.py; do
    compile_python_fuzzer "$fuzzer"
done
