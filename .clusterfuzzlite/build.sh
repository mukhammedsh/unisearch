#!/bin/bash -eu
# ClusterFuzzLite build script for UniSearch.
# Installs backend dependencies and packages Python fuzz targets into $OUT using compile_python_fuzzer.

# Install dependencies required by backend services.
# Note: requirements.txt is used here instead of requirements.lock because the OSS-Fuzz
# base-builder-python container uses a different Python runtime version than the 3.12-pinned wheels in requirements.lock.
python3 -m pip install --no-cache-dir -r backend/requirements.txt

# Pre-compile Python bytecode
python3 -m compileall -q backend/app

# Package all fuzz targets using OSS-Fuzz/ClusterFuzzLite compiler
for fuzzer in $SRC/unisearch/.clusterfuzzlite/fuzz_targets/fuzz_*.py; do
    compile_python_fuzzer "$fuzzer"
done
