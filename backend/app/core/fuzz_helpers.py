"""Helper utilities for fuzz testing and standalone verification."""
import struct


class SimpleFuzzedDataProvider:
    """Lightweight drop-in alternative to atheris.FuzzedDataProvider for local testing."""

    def __init__(self, data: bytes):
        self._data = bytearray(data)
        self._pos = 0

    def remaining_bytes(self) -> int:
        return max(0, len(self._data) - self._pos)

    def ConsumeBytes(self, count: int) -> bytes:
        if self._pos >= len(self._data):
            return b""
        end = min(len(self._data), self._pos + count)
        res = bytes(self._data[self._pos:end])
        self._pos = end
        return res

    def ConsumeUnicodeNoSurrogates(self, count: int) -> str:
        raw = self.ConsumeBytes(count)
        return raw.decode("utf-8", errors="ignore")

    def ConsumeIntInRange(self, min_val: int, max_val: int) -> int:
        if min_val >= max_val:
            return min_val
        raw = self.ConsumeBytes(4)
        if len(raw) < 4:
            val = 0
        else:
            val = struct.unpack(">I", raw)[0]
        span = (max_val - min_val) + 1
        return min_val + (val % span)

    def ConsumeBool(self) -> bool:
        raw = self.ConsumeBytes(1)
        return bool(raw and (raw[0] % 2 == 1))
