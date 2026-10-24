"""Start Last Light from any folder: python3 /path/to/last-light/run.py.

The app itself uses dependency-free Node.js. This launcher finds or provisions a
task-local Node 22 runtime, chooses a free port, and starts the application.
"""
from pathlib import Path
import argparse
import hashlib
import os
import platform
import shutil
import socket
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parent
CACHE = Path.home() / ("Library/Caches" if sys.platform == "darwin" else ".cache") / "last-light/node"


def supports_node(path):
    try:
        version = subprocess.check_output([str(path), "-p", "process.versions.node"], text=True).strip()
        return tuple(map(int, version.split(".")[:2])) >= (22, 13)
    except (OSError, subprocess.CalledProcessError, ValueError):
        return False


def get_node():
    existing = shutil.which("node")
    if existing and supports_node(existing):
        return Path(existing)
    for candidate in sorted(CACHE.glob("node-v*/bin/node"), reverse=True):
        if supports_node(candidate):
            return candidate
    system = {"darwin": "darwin", "linux": "linux"}.get(sys.platform)
    arch = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "x64", "AMD64": "x64"}.get(platform.machine())
    if not system or not arch or not shutil.which("curl"):
        raise RuntimeError("Install Node.js 22 or later from nodejs.org, then run this command again.")
    print("Preparing a local JavaScript runtime (first launch only)…", flush=True)
    base = "https://nodejs.org/dist/latest-v22.x/"
    checks = subprocess.check_output(["curl", "-fsSL", "--max-time", "30", base + "SHASUMS256.txt"], text=True)
    suffix = f"-{system}-{arch}.tar.gz"
    checksum, filename = next(line.split() for line in checks.splitlines() if line.endswith(suffix))
    CACHE.mkdir(parents=True, exist_ok=True)
    archive = CACHE / filename
    subprocess.run(["curl", "-fsSL", "--max-time", "180", base + filename, "-o", str(archive)], check=True)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != checksum:
        archive.unlink(missing_ok=True)
        raise RuntimeError("Runtime verification failed. Please run the command again.")
    with tarfile.open(archive) as source:
        source.extractall(CACHE, filter="data")
    archive.unlink(missing_ok=True)
    return CACHE / filename.removesuffix(".tar.gz") / "bin/node"


def available(port):
    with socket.socket() as check:
        try:
            check.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def main():
    parser = argparse.ArgumentParser(description="Start the Last Light adventure app")
    parser.add_argument("--port", type=int, help="Choose a specific port (default: first free port from 8000)")
    parser.add_argument("--test", action="store_true", help="Run the automated story and backend checks")
    args = parser.parse_args()
    if args.test:
        node = get_node()
        tests = sorted(str(path) for path in (ROOT / 'tests').glob('*.test.js'))
        os.execve(str(node), [str(node), '--test', *tests], os.environ.copy())
    if args.port is not None and not 1024 <= args.port <= 65535:
        parser.error("Choose a port between 1024 and 65535.")
    ports = [args.port] if args.port else range(8000, 8011)
    port = next((candidate for candidate in ports if available(candidate)), None)
    if port is None:
        raise RuntimeError("The requested port is in use. Stop the old server with Ctrl+C, or add --port 8011.")
    if args.port is None and port != 8000:
        print(f"Port 8000 is occupied; using {port} for the new app.", flush=True)
    node = get_node()
    os.chdir(ROOT)
    os.execve(str(node), [str(node), str(ROOT / "server.mjs")], {**os.environ, "PORT": str(port)})


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, OSError, StopIteration) as error:
        print(f"Could not start Last Light: {error}", file=sys.stderr)
        sys.exit(1)
