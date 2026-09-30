FROM gcr.io/oss-fuzz-base/base-builder-python@sha256:372a2ade09ba2716512857a5f7b797bf3190cd228a8a81f55a72028571032b02

RUN useradd --create-home --shell /usr/sbin/nologin fuzzer \
    && touch /usr/lib/libFuzzingEngine.a \
    && chown -R fuzzer:fuzzer /usr/lib/libFuzzingEngine.a "$OUT"

USER fuzzer

ENV PYTHONPYCACHEPREFIX=$OUT/pycache

COPY --chown=fuzzer:fuzzer backend/app $SRC/unisearch/backend/app
COPY --chown=fuzzer:fuzzer backend/data $SRC/unisearch/backend/data
COPY --chown=fuzzer:fuzzer backend/requirements.lock $SRC/unisearch/backend/requirements.lock
COPY --chown=fuzzer:fuzzer backend/requirements.txt $SRC/unisearch/backend/requirements.txt
COPY --chown=fuzzer:fuzzer .clusterfuzzlite/fuzz_targets $SRC/unisearch/.clusterfuzzlite/fuzz_targets
WORKDIR $SRC/unisearch

COPY --chown=fuzzer:fuzzer .clusterfuzzlite/build.sh $SRC/build.sh
