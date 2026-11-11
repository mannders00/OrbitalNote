#!/usr/bin/env python3
"""Build a static WASM demo from the current app sources, without editing them."""
import hashlib
import gzip
import json
import os
from pathlib import Path
import re
import shutil
import shlex
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "bin" / "demo"

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # bin/demo is exclusively generated output. Never copy or modify app sources.
    for item in OUT.iterdir():
        if item.is_dir(): shutil.rmtree(item)
        else: item.unlink()
    ui = ROOT / "app" / "ui"
    api_methods = set(re.findall(r'\b(\w+): q =>', (ui / "api.js").read_text()))
    demo_methods = set(re.findall(r'case "(\w+)":', (ROOT / "demo" / "service.go").read_text()))
    if api_methods - demo_methods - {"Open"}:
        raise SystemExit(f"New app methods need demo routing: {api_methods - demo_methods - {'Open'}}")
    manifest = {}
    patterns = shlex.split(" ".join(re.findall(r'^//go:embed (.+)$', (ui / "assets.go").read_text(), re.M)))
    if not patterns: raise SystemExit("App asset manifest not found")
    sources = sorted({source for pattern in patterns for source in ui.glob(pattern) if source.is_file()})
    for source in sources:
        relative = source.relative_to(ui)
        target = OUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        manifest[str(relative)] = hashlib.sha256(source.read_bytes()).hexdigest()
    # Only the generated HTML shell changes: bootstrap first, WASM CSP, demo CSS.
    html = (OUT / "index.html").read_text()
    if html.count('src="/app.js"') != 1:
        raise SystemExit("App entry point changed; update the demo HTML adapter before publishing")
    html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
    csp = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
    html = html.replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">')
    html = html.replace('src="/app.js"', 'src="/bootstrap.js"')
    html = html.replace('</head>', '<link rel="stylesheet" href="/demo.css"></head>')
    (OUT / "index.html").write_text(html)
    for source in (ROOT / "demo" / "browser").iterdir(): shutil.copyfile(source, OUT / source.name)
    goroot = subprocess.check_output(["go", "env", "GOROOT"], text=True).strip()
    shutil.copyfile(Path(goroot) / "lib" / "wasm" / "wasm_exec.js", OUT / "wasm_exec.js")
    subprocess.run(["go", "build", "-trimpath", "-ldflags=-s -w", "-o", str(OUT / "engine.wasm"), "./demo/wasm"], cwd=ROOT, env={**os.environ, "GOOS": "js", "GOARCH": "wasm"}, check=True)
    (OUT / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    shutil.copyfile(ROOT / "LICENSE", OUT / "LICENSE")
    shutil.copyfile(ROOT / "NOTICE", OUT / "NOTICE")
    # Precompressed files work on static hosts as well as Caddy's on-the-fly encoder.
    for source in OUT.rglob("*"):
        if source.is_file() and source.suffix in {".wasm", ".js", ".css"} and source.stat().st_size > 100_000:
            source.with_name(source.name + ".gz").write_bytes(gzip.compress(source.read_bytes(), mtime=0))
    print(f"Built {OUT} ({(OUT / 'engine.wasm.gz').stat().st_size / 1024 / 1024:.1f} MiB compressed WASM)")

if __name__ == "__main__": main()
