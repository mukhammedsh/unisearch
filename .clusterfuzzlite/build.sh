#!/bin/bash -eu
# ClusterFuzzLite build script for UniSearch.
# Installs backend dependencies and packages Python fuzz targets into $OUT using compile_python_fuzzer.

# Install dependencies required by backend services
# Filter out torch dependency from requirements.lock if present as ML embeddings are disabled during fuzzing
grep -v "torch" backend/requirements.lock > /tmp/requirements-fuzz.lock 2>/dev/null || true
python3 -m pip install --require-hashes --only-binary=:all: -r /tmp/requirements-fuzz.lock 2>/dev/null || \
python3 -m pip install fastapi uvicorn pydantic redis prometheus-fastapi-instrumentator sentry-sdk httpx

# Pre-compile Python bytecode
python3 -m compileall -q backend/app

# Package all fuzz targets using OSS-Fuzz/ClusterFuzzLite compiler
for fuzzer in $SRC/unisearch/.clusterfuzzlite/fuzz_targets/fuzz_*.py; do
    compile_python_fuzzer "$fuzzer"
done
