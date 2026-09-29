FROM gcr.io/oss-fuzz-base/base-builder-python@sha256:372a2ade09ba2716512857a5f7b797bf3190cd228a8a81f55a72028571032b02

RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin fuzzer \
    && chown -R fuzzer:fuzzer "$OUT" "$SRC"

ENV PYTHONPYCACHEPREFIX=$OUT/pycache
ENV LIB_FUZZING_ENGINE_DEPRECATED=/tmp/libFuzzingEngine.a

COPY backend/app $SRC/unisearch/backend/app
COPY backend/data $SRC/unisearch/backend/data
COPY .clusterfuzzlite/requirements.lock $SRC/unisearch/.clusterfuzzlite/requirements.lock
COPY .clusterfuzzlite/fuzz_targets $SRC/unisearch/.clusterfuzzlite/fuzz_targets
WORKDIR $SRC/unisearch

COPY .clusterfuzzlite/build.sh $SRC/build.sh

RUN chown -R fuzzer:fuzzer "$SRC"
USER fuzzer
