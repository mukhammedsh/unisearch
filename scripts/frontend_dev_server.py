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


def build_file_index(base_dir: Path) -> dict[str, Path]:
    resolved_base = base_dir.resolve()
    file_index: dict[str, Path] = {}

    for root, _dirs, files in os.walk(resolved_base):
        root_path = Path(root)
        for file_name in files:
            file_path = (root_path / file_name).resolve()
            try:
                relative_key = file_path.relative_to(resolved_base).as_posix()
            except ValueError:
                continue
            file_index[relative_key] = file_path

    return file_index


class FrontendDevHandler(SimpleHTTPRequestHandler):
    server_version = "UniSearchFrontendDev/1.0"

    def do_GET(self) -> None:
        self._serve_request(include_body=True)

    def do_HEAD(self) -> None:
        self._serve_request(include_body=False)

    def _serve_request(self, *, include_body: bool) -> None:
        target = resolve_frontend_target(self.path)
        filesystem_path = self._lookup_indexed_file(target)

        if filesystem_path:
            self._send_file(filesystem_path, include_body=include_body)
            return

        index_path = self._lookup_indexed_file(f"{target.rstrip('/')}/index.html")
        if index_path:
            self._send_file(index_path, include_body=include_body)
            return

        self._send_custom_404(include_body=include_body)

    def _lookup_indexed_file(self, relative_path: str) -> Path | None:
        clean_relative = str(relative_path or "").replace("\\", "/").lstrip("/")
        file_index = getattr(self.server, "file_index", {})
        return file_index.get(clean_relative)

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
        self._send_security_headers()
        self.end_headers()

        if include_body:
            self.wfile.write(data)

    def _send_custom_404(self, *, include_body: bool) -> None:
        not_found_file = self._lookup_indexed_file("404.html")
        if not_found_file:
            self._send_file(not_found_file, include_body=include_body, status=404)
            return

        payload = b"404 Not Found"
        self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self._send_security_headers()
        self.end_headers()
        if include_body:
            self.wfile.write(payload)

    def _send_security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        self.send_header(
            "Content-Security-Policy-Report-Only",
            "default-src 'self'; connect-src 'self' http://127.0.0.1:* http://localhost:*; img-src 'self' data:; style-src 'self' 'unsafe-inline'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
        )


class FrontendThreadingHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 128


def main() -> None:
    parser = argparse.ArgumentParser(description="UniSearch frontend dev server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5501)
    parser.add_argument("--directory", required=True)
    args = parser.parse_args()

    mimetypes.add_type("application/javascript", ".js")

    directory_path = Path(args.directory).resolve()
    directory = str(directory_path)
    file_index = build_file_index(directory_path)
    handler_class = lambda *handler_args, **handler_kwargs: FrontendDevHandler(
        *handler_args,
        directory=directory,
        **handler_kwargs,
    )

    with FrontendThreadingHTTPServer((args.host, args.port), handler_class) as httpd:
        httpd.file_index = file_index
        print("[frontend-dev-server] serving indexed frontend files")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
