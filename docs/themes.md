# OrbitalNote Theme v1

Choose a built-in theme in Settings → Appearance. Custom CSS is applied after
the selected theme and saved locally. Paste it into Custom theme CSS and choose
Apply custom CSS. Clear custom CSS restores the selected built-in theme.

Theme files are UTF-8 CSS, conventionally named `name.orbitalnote.css`, with a
version/name comment and a `:root` rule containing any token overrides:

```css
/* OrbitalNote Theme v1: Aurora */
:root {
  color-scheme: dark;
  --bg: #101827;
  --side: #182338;
  --ribbon: #182338;
  --panel: #202d44;
  --text: #dce7f7;
  --muted: #9aaec9;
  --faint: #70849f;
  --border: #2d405e;
  --hover: #263853;
  --selected: #314769;
  --accent: #8bb9ff;
  --button: #347ed7;
  --blue-soft: #263446;
  --warn: #d4ad73;
  --todo: #e88787;
  --warn-bg: #352e23;
  --code: #b6c9de;
  --shadow: #0006;
}
```

These color tokens are the v1 compatibility contract; omitted tokens inherit
from the selected theme. Standard CSS rules may also customize individual UI
elements, though internal class names may change. Custom styles do not alter
note contents. Use a matching light/dark base for native window appearance.

Built-ins: Workbench, Paper, Focus, Nord, Field Notes, Studio, Terminal,
Editorial, Soft Focus, and Blueprint. They change typography, spacing, controls,
tabs, and document treatment as well as colors. System follows the operating
system's light/dark preference.

Self-contained examples are in `examples/Themes/`. A comment containing
`Base appearance: light` or `Base appearance: dark` selects that native appearance
and replaces the built-in treatment with the custom file. Without the comment,
custom CSS is an overlay. `--done` controls completed task-state text.
