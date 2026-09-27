#!/usr/bin/env bash
# Called from the repository root by native mobile packaging scripts.
set -euo pipefail
destination="${1:?License destination required}"
mkdir -p "$destination"
chmod -R u+w "$destination"
cp LICENSE NOTICE TRADEMARKS.md "$destination/"
cp app/ui/vendor/LICENSES.txt "$destination/editor-LICENSES.txt"
while read -r module directory; do
  if [ -z "$directory" ] || [ "$module" = github.com/mannders00/OrbitalNote ]; then continue; fi
  for notice in "$directory"/LICENSE* "$directory"/NOTICE* "$directory"/COPYING*; do
    if [ -f "$notice" ]; then
      target="$destination/${module//\//_}"
      mkdir -p "$target"
      cp "$notice" "$target/"
    fi
  done
done < <(go list -m -f '{{.Path}} {{.Dir}}' all)
