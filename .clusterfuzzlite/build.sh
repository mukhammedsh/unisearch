#!/bin/bash -eu
# ClusterFuzzLite build script for UniSearch.
# Installs backend dependencies and packages Python fuzz targets into $OUT using compile_python_fuzzer.

# Install dependencies required by backend services (excluding torch URL wheel which is Linux x86_64 CPU specific)
grep -v "^torch @" backend/requirements.lock > /tmp/requirements-fuzz.lock
python3 -m pip install --require-hashes --only-binary=:all: -r /tmp/requirements-fuzz.lock || python3 -m pip install --no-deps -r backend/requirements.txt

# Pre-compile Python bytecode
python3 -m compileall -q backend/app

# Package all fuzz targets using OSS-Fuzz/ClusterFuzzLite compiler
for fuzzer in $SRC/unisearch/.clusterfuzzlite/fuzz_targets/fuzz_*.py; do
    compile_python_fuzzer "$fuzzer"
done
