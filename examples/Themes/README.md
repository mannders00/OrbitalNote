# Themes for real workflows

Choose any preset in Settings → Appearance, or paste one complete `.orbitalnote.css`
file into **Custom theme CSS** and apply it. One file changes colors, typography,
spacing, controls, and document treatment. These files use the **Theme v1** format.

| Theme | Intended use |
| --- | --- |
| [Workbench](workbench.orbitalnote.css) | Original compact, neutral workspace for project work and split panes |
| [Terminal](terminal.orbitalnote.css) | Original dense monospace layout, square controls, and Base16-inspired grays |
| [Editorial](editorial.orbitalnote.css) | Book typography, a measured reading column, warm paper, and ink rules |
| [Studio](studio.orbitalnote.css) | Floating tabs, rounded task cards, framed writing surfaces, and violet accents |
| [Focus](focus.orbitalnote.css) | Larger text, open spacing, quiet navigation, and readable controls |
| [Blueprint](blueprint.orbitalnote.css) | Strong rules, monospaced labels, square controls, and structured tables |

All six built-ins offer **System**, **Light**, and **Dark** appearances. These
standalone files export each family's default appearance. Regenerate them with
`node scripts/export-themes.mjs`.

The `Base appearance: light` or `dark` comment makes each sample standalone:
it replaces the built-in treatment and sets matching native appearance. Smaller
CSS snippets without that comment overlay the selected preset.
Clear custom CSS to return to the selected preset. All assets/fonts are local or
system-provided; no online font requests are made.

Color tokens are the Theme v1 compatibility contract. CSS selectors allow more
creative customization but may evolve. See [the theme guide](../../docs/themes.md)
for the format, migration details, and layout guidance.
