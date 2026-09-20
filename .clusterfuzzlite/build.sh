#!/bin/bash -eu
# ClusterFuzzLite build script for UniSearch.
# Installs backend dependencies and packages Python fuzz targets into $OUT using compile_python_fuzzer.

# Install dependencies required by backend services
python3 -m pip install -r backend/requirements.txt

# Pre-compile Python bytecode
python3 -m compileall -q backend/app

# Package all fuzz targets using OSS-Fuzz/ClusterFuzzLite compiler
for fuzzer in $SRC/unisearch/.clusterfuzzlite/fuzz_targets/fuzz_*.py; do
    compile_python_fuzzer "$fuzzer"
done
