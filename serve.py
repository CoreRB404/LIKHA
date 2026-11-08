"""Run LIKHA locally: python serve.py (forward port 8000)."""

import argparse
import gzip
import re
import socket
import threading
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


@lru_cache(maxsize=64)
def compressed_file(path, modified, size):
    return gzip.compress(Path(path).read_bytes(), compresslevel=6, mtime=0)


class SiteHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webp": "image/webp",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".css": "text/css",
        ".js": "text/javascript",
        ".html": "text/html; charset=utf-8",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
    }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Revalidate local edits, while allowing unchanged files to return 304.
        self.send_header("Cache-Control", "no-store" if self.path.split("?", 1)[0].endswith(("/", ".html")) else "no-cache")
        if self.path.split("?", 1)[0].lower().endswith((".mp4", ".mov")):
            self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        self.range_remaining = None
        path = Path(self.translate_path(self.path))
        # This remains an offline-demo server, never an account backend. The
        # repository now also contains private application code and local data.
        resolved = path.resolve()
        if not resolved.is_relative_to(ROOT):
            self.send_error(404)
            return None
        parts = resolved.relative_to(ROOT).parts
        public_folders = {"assets", "images", "craftlab", "festival_lab"}
        allowed_suffixes = {".html", ".css", ".js", ".ico", ".webp", ".png", ".jpg", ".jpeg", ".mp4", ".mov", ".mp3", ".wav", ".ogg"}
        if parts and (parts[0] not in public_folders and not (len(parts) == 1 and resolved.suffix in {".html", ".css", ".js", ".ico"}) and not (len(parts) == 2 and parts[0] == ".vscode" and resolved.suffix == ".html")):
            self.send_error(404)
            return None
        if resolved.is_file() and resolved.suffix.lower() not in allowed_suffixes:
            self.send_error(404)
            return None
        if resolved.is_dir() and resolved != ROOT:
            self.send_error(404)
            return None
        if path.is_dir() and self.path.split("?", 1)[0].endswith("/"):
            path = path / "index.html"
        # Browsers request portions of a video for playback and seeking.
        if path.is_file() and path.suffix.lower() in {".mp4", ".mov"} and self.headers.get("Range"):
            size = path.stat().st_size
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers["Range"].strip())
            start, end = 0, size - 1
            valid = bool(match and (match[1] or match[2]))
            if valid:
                if match[1]:
                    start = int(match[1])
                    end = min(int(match[2]), size - 1) if match[2] else size - 1
                else:
                    valid = int(match[2]) > 0
                    start = max(0, size - int(match[2]))
                valid = valid and 0 <= start <= end < size
            if not valid:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None
            source = path.open("rb")
            source.seek(start)
            self.range_remaining = end - start + 1
            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(str(path)))
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(self.range_remaining))
            self.end_headers()
            return source
        accepts_gzip = "gzip" in self.headers.get("Accept-Encoding", "")
        if accepts_gzip and path.is_file() and path.suffix in {".html", ".css", ".js", ".json", ".svg"}:
            stat = path.stat()
            etag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}-gzip"'
            if self.headers.get("If-None-Match") == etag:
                self.send_response(304)
                self.send_header("ETag", etag)
                self.send_header("Vary", "Accept-Encoding")
                self.end_headers()
                return None
            from io import BytesIO

            body = compressed_file(str(path), stat.st_mtime_ns, stat.st_size)
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(str(path)))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("ETag", etag)
            self.send_header("Vary", "Accept-Encoding")
            self.end_headers()
            return BytesIO(body)
        return super().send_head()

    def copyfile(self, source, outputfile):
        if self.range_remaining is None:
            return super().copyfile(source, outputfile)
        while self.range_remaining:
            chunk = source.read(min(self.range_remaining, 64 * 1024))
            if not chunk:
                break
            outputfile.write(chunk)
            self.range_remaining -= len(chunk)


class IPv6Server(ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
        super().server_bind()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), SiteHandler)
    ipv6_server = None
    try:
        ipv6_server = IPv6Server(("::1", args.port), SiteHandler)
        threading.Thread(target=ipv6_server.serve_forever, daemon=True).start()
    except OSError:
        # IPv4 still works on systems without IPv6 loopback support.
        pass
    print(f"LIKHA running at http://localhost:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if ipv6_server:
            ipv6_server.shutdown()
            ipv6_server.server_close()
