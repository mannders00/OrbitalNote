# Bundled source editor

The desktop application serves `app/ui/vendor/editor.js` locally. Native builds
use this checked-in bundle, so users do not need a frontend build tool.

After changing `source.js` or dependencies, rebuild from this directory:

```sh
bun install --frozen-lockfile
bun run build
```

Commit `bun.lock`, the generated bundle, and `app/ui/vendor/LICENSES.txt` together.
The build collects dependency licenses for distribution with the application.

CodeMirror owns source text, wrapping, variable-height headings, selection and
undo history. Org styles are decorations: formatting characters remain in the
document and checkbox widgets never become source text. The app still retains
the original raw buffer separately to preserve untouched mixed line endings.
