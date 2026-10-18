#!/usr/bin/env python3
"""Exercise real macOS WebView/Host/Keychain sync against a release daemon.

Usage: python3 scripts/check-native-sync.py PATH_TO_DAEMON
The production sources are instrumented with Go overlays, never edited or mocked.
"""
import json
import hashlib
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent


def main():
    binary = Path(sys.argv[1]).resolve()
    with tempfile.TemporaryDirectory(prefix="orbitalnote-native-sync-", dir=ROOT / "bin") as temporary:
        root = Path(temporary)
        for name in ("home", "native", "peer"):
            (root / name).mkdir()
        (root / "native/Native.org").write_text("* Written by the native desktop\n")
        # Keep the real application and UI, replacing only initial workspace
        # selection and adding the test driver at the WebView ready event.
        source = (ROOT / "app/main.go").read_text()
        source = source.replace("openInitialWorkspace(s)", "probeOpenWorkspace(s)")
        source = source.replace("if err := a.Run(); err != nil {", "installSyncProbe(a, w, h)\n\tif err := a.Run(); err != nil {")
        (root / "main.go").write_text(source)
        prefs = (ROOT / "app/preferences.go").read_text().replace("os.UserConfigDir()", "probeConfigDir()")
        (root / "preferences.go").write_text(prefs)
        (root / "overlay.json").write_text(json.dumps({"Replace": {
            str(ROOT / "app/main.go"): str(root / "main.go"),
            str(ROOT / "app/preferences.go"): str(root / "preferences.go"),
            str(ROOT / "app/native_sync_probe.go"): str(ROOT / "scripts/native-smoke/sync-probe.go.txt"),
        }}))
        app = root / "native-probe"
        build = subprocess.run(["go", "build", "-tags", "production", "-overlay", str(root / "overlay.json"), "-o", str(app), "./app"], cwd=ROOT, text=True, capture_output=True)
        if build.returncode:
            raise RuntimeError(build.stdout + build.stderr)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            address = f"127.0.0.1:{listener.getsockname()[1]}"
        origin = "http://" + address
        env = {k:v for k,v in os.environ.items() if not k.startswith("SYNC_")}
        env.update(SYNC_DATA_DIR=str(root / "server"), SYNC_LISTEN=address,
                   SYNC_PUBLIC_URL=origin, SYNC_SIGNUP_CODE="native-e2e-invitation")
        with (root / "daemon.log").open("w") as log:
            daemon = subprocess.Popen([str(binary)], env=env, stdout=log, stderr=log)
            try:
                for _ in range(100):
                    try:
                        with urllib.request.urlopen(origin + "/healthz", timeout=1) as response:
                            if response.status == 200:
                                break
                    except OSError:
                        time.sleep(.1)
                else:
                    raise RuntimeError((root / "daemon.log").read_text())
                env.update(SYNC_PROBE_ROOT=str(root), SYNC_PROBE_URL=origin)
                for phase in ("create", "restart"):
                    env["SYNC_PROBE_PHASE"] = phase
                    subprocess.run([str(app)], env=env, cwd=ROOT, check=True, timeout=110)
                    result = json.loads((root / f"result-{phase}.json").read_text())
                    if not result["ok"]:
                        raise RuntimeError(result["detail"])
                    print("PASS:", result["detail"], flush=True)
            finally:
                daemon.terminate()
                daemon.wait(timeout=15)
                # Remove only this disposable workspace's Keychain item,
                # including when a failed run never reaches Disconnect.
                key = hashlib.sha256(str(root / "native").encode()).hexdigest()
                subprocess.run(["security", "delete-generic-password", "-s", "OrbitalNote Sync", "-a", key], capture_output=True)


if __name__ == "__main__":
    main()
