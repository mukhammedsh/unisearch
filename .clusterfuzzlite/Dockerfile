FROM gcr.io/oss-fuzz-base/base-builder-python@sha256:372a2ade09ba2716512857a5f7b797bf3190cd228a8a81f55a72028571032b02

COPY . $SRC/unisearch
WORKDIR $SRC/unisearch

COPY .clusterfuzzlite/build.sh $SRC/build.sh
