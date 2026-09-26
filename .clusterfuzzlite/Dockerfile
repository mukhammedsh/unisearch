FROM gcr.io/oss-fuzz-base/base-builder-python@sha256:372a2ade09ba2716512857a5f7b797bf3190cd228a8a81f55a72028571032b02


ENV PYTHONPYCACHEPREFIX=$OUT/pycache

COPY backend/app $SRC/unisearch/backend/app
COPY backend/data $SRC/unisearch/backend/data
COPY backend/requirements.lock $SRC/unisearch/backend/requirements.lock
COPY .clusterfuzzlite/fuzz_targets $SRC/unisearch/.clusterfuzzlite/fuzz_targets
WORKDIR $SRC/unisearch

COPY .clusterfuzzlite/build.sh $SRC/build.sh
