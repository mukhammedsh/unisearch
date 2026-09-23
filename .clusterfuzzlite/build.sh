#!/bin/bash -eu
# ClusterFuzzLite build script for UniSearch.
# Installs backend dependencies and packages Python fuzz targets into $OUT using compile_python_fuzzer.

# Install exact pinned dependencies required by backend services during fuzzing
python3 -m pip install fastapi==0.141.1 uvicorn==0.52.4 pydantic==2.13.5 redis==8.1.0 prometheus-fastapi-instrumentator==8.1.0 sentry-sdk==2.69.1 "numpy>=1.26.0"

# Pre-compile Python bytecode
python3 -m compileall -q backend/app

# Package all fuzz targets using OSS-Fuzz/ClusterFuzzLite compiler
for fuzzer in $SRC/unisearch/.clusterfuzzlite/fuzz_targets/fuzz_*.py; do
    compile_python_fuzzer "$fuzzer"
done
