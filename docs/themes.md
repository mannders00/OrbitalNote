# OrbitalNote Theme v1

Choose a built-in family in Settings → Theme, then choose **System**, **Light**, or
**Dark** under Appearance. All six themes include matching light/dark
palettes. System follows the operating system without switching theme families.
Existing fixed theme choices retain their appearance; new installs follow System.

## Six distinct ways to work

| Theme | Visual direction |
| --- | --- |
| **Workbench** | The original compact, neutral workspace for project work and split panes. |
| **Terminal** | The original dense monospace layout, square controls, and Base16-inspired grays. |
| **Editorial** | Book typography, a measured reading column, warm paper, and ink rules for long-form writing. |
| **Studio** | Floating tabs, rounded task cards, a framed writing surface, and violet accents for visual planning. |
| **Focus** | Larger type, generous spacing, quiet navigation, and clearly visible controls. |
| **Blueprint** | Strong rules, square controls, monospaced labels, and structured technical tables. |

Each family keeps its typography and layout when you switch appearances. Fonts
are system-provided; themes need no external assets. Workbench and Terminal retain
their existing theme styles. Calendar timing and task interactions work the same
in every family.

Earlier color-only and overlapping presets migrate automatically: Paper, Field
Notes, and Ember become Editorial; Nord and Aurora become Workbench; Soft Focus
becomes Focus; Iris becomes Studio. Explicit System/Light/Dark preferences and
custom CSS are preserved. Legacy choices without an appearance preference retain
their original light or dark default. Shared workspace theme settings are also
recognized and mapped to the retained families.

## Create your own theme

Custom CSS is applied after
the selected theme and saved locally. Paste it into Custom theme CSS and choose
Apply custom CSS. Clear custom CSS restores the selected built-in theme.

Theme files are UTF-8 CSS, conventionally named `name.orbitalnote.css`, with a
version/name comment and a `:root` rule containing any token overrides:

```css
/* OrbitalNote Theme v1: Night desk */
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

Terminal uses Base16 Default-inspired charcoal and gray surfaces with muted
blue, green, amber, red, cyan, and violet accents. Its light counterpart uses
neutral paper surfaces and deeper accents for readability.

Self-contained examples are in [`examples/Themes/`](../examples/Themes/). They
use the same CSS as the built-ins and can be regenerated with
`node scripts/export-themes.mjs`. A comment containing
`Base appearance: light` or `Base appearance: dark` selects that native appearance
and replaces the built-in treatment with the custom file. Without the comment,
custom CSS is an overlay. `--done` controls completed task-state text.

Typography and spacing can be changed alongside the colors:

```css
/* An overlay on the selected family */
:root { --document-size: 15px; --document-leading: 1.85; }
.ui-preview { font-family: Georgia, serif; line-height: 1.85; }
.ui-preview blockquote { border-left: 2px solid var(--accent); font-style: italic; }
```

Keep event positioning and `.time-day` height intact: the day/week calendar uses
one pixel per minute. Avoid changing Agenda's task-state width or height; its
fixed control column keeps task titles aligned across days and states. Check your
theme in narrow split panes as well as a full-width window.
