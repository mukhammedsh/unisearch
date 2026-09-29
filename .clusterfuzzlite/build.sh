#!/bin/bash -eu
# ClusterFuzzLite build script for UniSearch.
# Installs backend dependencies and packages Python fuzz targets into $OUT using compile_python_fuzzer.

# Filter out Python 3.12-pinned torch wheel hashes to allow installation in OSS-Fuzz Python 3.10 container
grep -v "^torch " backend/requirements.lock > /tmp/fuzz-requirements.lock

# Install dependencies required by backend services with strict hash verification
python3 -m pip install --require-hashes --only-binary=:all: -r /tmp/fuzz-requirements.lock

# Pre-compile Python bytecode
python3 -m compileall -q backend/app

# Package all fuzz targets using OSS-Fuzz/ClusterFuzzLite compiler
for fuzzer in $SRC/unisearch/.clusterfuzzlite/fuzz_targets/fuzz_*.py; do
    compile_python_fuzzer "$fuzzer"
done
