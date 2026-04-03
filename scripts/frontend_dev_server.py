from __future__ import annotations

import argparse
import mimetypes
import os
import posixpath
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


PRETTY_ROUTE_MAP = {
    "/": "index.html",
    "/index.html": "index.html",
    "/universities": "universities.html",
    "/universities.html": "universities.html",
    "/ranking": "ranking.html",
    "/ranking.html": "ranking.html",
    "/guide": "guide.html",
    "/guide.html": "guide.html",
    "/about": "about.html",
    "/about.html": "about.html",
    "/404": "404.html",
    "/404.html": "404.html",
}

DETAIL_ROUTE_RE = re.compile(r"^/universities/[^/]+/?$")


def normalize_request_path(raw_path: str) -> str:
    parsed_path = urlsplit(raw_path).path or "/"
    decoded = unquote(parsed_path)
    collapsed = re.sub(r"/{2,}", "/", decoded)

    if collapsed == "/frontend":
        collapsed = "/"
    elif collapsed.startswith("/frontend/"):
        collapsed = collapsed[len("/frontend") :]

    normalized = posixpath.normpath(collapsed)
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    if collapsed.endswith("/") and not normalized.endswith("/"):
        normalized = f"{normalized}/"
    return normalized


def resolve_frontend_target(request_path: str) -> str:
    normalized = normalize_request_path(request_path)

    if normalized in PRETTY_ROUTE_MAP:
        return PRETTY_ROUTE_MAP[normalized]

    trimmed = normalized[:-1] if normalized.endswith("/") and normalized != "/" else normalized
    if trimmed in PRETTY_ROUTE_MAP:
        return PRETTY_ROUTE_MAP[trimmed]

    if DETAIL_ROUTE_RE.fullmatch(trimmed):
        return "university.html"

    return normalized.lstrip("/")


class FrontendDevHandler(SimpleHTTPRequestHandler):
    server_version = "UniSearchFrontendDev/1.0"

    def do_GET(self) -> None:
        self._serve_request(include_body=True)

    def do_HEAD(self) -> None:
        self._serve_request(include_body=False)

    def _serve_request(self, *, include_body: bool) -> None:
        target = resolve_frontend_target(self.path)
        filesystem_path = self._safe_filesystem_path(target)

        if filesystem_path and filesystem_path.is_file():
            self._send_file(filesystem_path, include_body=include_body)
            return

        if filesystem_path and filesystem_path.is_dir():
            index_file = filesystem_path / "index.html"
            if index_file.is_file():
                self._send_file(index_file, include_body=include_body)
                return

        self._send_custom_404(include_body=include_body)

    def _safe_filesystem_path(self, relative_path: str) -> Path | None:
        base_dir = Path(self.directory).resolve()
        clean_relative = str(relative_path or "").replace("\\", "/").lstrip("/")
        candidate = (base_dir / clean_relative).resolve()

        try:
            candidate.relative_to(base_dir)
        except ValueError:
            return None
        return candidate

    def _send_file(self, file_path: Path, *, include_body: bool, status: int = 200) -> None:
        content_type = self.guess_type(str(file_path))
        try:
            with file_path.open("rb") as handle:
                data = handle.read()
        except OSError:
            self._send_custom_404(include_body=include_body)
            return

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        if include_body:
            self.wfile.write(data)

    def _send_custom_404(self, *, include_body: bool) -> None:
        not_found_file = self._safe_filesystem_path("404.html")
        if not_found_file and not_found_file.is_file():
            self._send_file(not_found_file, include_body=include_body, status=404)
            return

        payload = b"404 Not Found"
        self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if include_body:
            self.wfile.write(payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="UniSearch frontend dev server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5501)
    parser.add_argument("--directory", required=True)
    args = parser.parse_args()

    mimetypes.add_type("application/javascript", ".js")

    directory = str(Path(args.directory).resolve())
    handler_class = lambda *handler_args, **handler_kwargs: FrontendDevHandler(
        *handler_args,
        directory=directory,
        **handler_kwargs,
    )

    with ThreadingHTTPServer((args.host, args.port), handler_class) as httpd:
        print(f"[frontend-dev-server] serving {directory} at http://{args.host}:{args.port}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
