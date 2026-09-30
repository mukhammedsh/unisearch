#!/bin/bash -eu
# ClusterFuzzLite build script for UniSearch.
# Installs backend dependencies and packages Python fuzz targets into $OUT using compile_python_fuzzer.

# The targets use schema validation and pure-Python scoring with embeddings disabled.
python3 -m pip install --user --require-hashes --only-binary=:all: -r .clusterfuzzlite/requirements.lock

# Pre-compile Python bytecode
python3 -m compileall -q backend/app

# Package all fuzz targets using OSS-Fuzz/ClusterFuzzLite compiler
for fuzzer in $SRC/unisearch/.clusterfuzzlite/fuzz_targets/fuzz_*.py; do
    compile_python_fuzzer "$fuzzer" --paths "$SRC/unisearch/backend" --add-data "$SRC/unisearch/backend/data:data"
done
