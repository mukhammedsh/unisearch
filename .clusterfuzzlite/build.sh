#!/bin/bash -eu
# ClusterFuzzLite build script for UniSearch.
# Installs backend dependencies and packages Python fuzz targets into $OUT using compile_python_fuzzer.

# Ensure backend directory is in PYTHONPATH so PyInstaller bundles backend/app into fuzz targets
export PYTHONPATH="$SRC/unisearch/backend:${PYTHONPATH:-}"

# Filter out ML/PyTorch packages from requirements.lock for fuzzing environment where embeddings are disabled
python3 -c '
ml_pkgs = {
    "torch", "sentence-transformers", "transformers", "tokenizers",
    "huggingface-hub", "scikit-learn", "scipy", "sympy", "networkx",
    "filelock", "fsspec", "hf-xet", "joblib", "narwhals", "pyyaml",
    "regex", "safetensors", "threadpoolctl", "tqdm"
}
with open("backend/requirements.lock", "r", encoding="utf-8") as f:
    lines = f.readlines()
out, skip = [], False
for line in lines:
    stripped = line.strip()
    if stripped and not line.startswith(" ") and not line.startswith("#") and not line.startswith("-"):
        pkg = stripped.split("==")[0].split("@")[0].strip().lower()
        skip = pkg in ml_pkgs
    if not skip:
        out.append(line)
with open("/tmp/requirements-fuzz.lock", "w", encoding="utf-8") as f:
    f.writelines(out)
'

# Install hashed dependencies required by backend services
python3 -m pip install --require-hashes --only-binary=:all: -r /tmp/requirements-fuzz.lock

# Pre-compile Python bytecode
python3 -m compileall -q backend/app

# Package all fuzz targets using OSS-Fuzz/ClusterFuzzLite compiler
for fuzzer in $SRC/unisearch/.clusterfuzzlite/fuzz_targets/fuzz_*.py; do
    compile_python_fuzzer "$fuzzer"
done
