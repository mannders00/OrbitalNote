#!/bin/bash
cd "$(dirname "$0")" || exit 1
bash scripts/build-macos-arm64.sh
result=$?
if [ "$result" -eq 0 ]; then
  echo "Build complete. Open the OrbitalNote.app bundle in bin/."
fi
echo "Press Return to close this window."
read -r _
exit "$result"
