# Themes for real workflows

Choose any preset in Settings → Appearance, or paste one complete `.orbitalnote.css`
file into **Custom theme CSS** and apply it. One file changes colors, typography,
spacing, controls, and document treatment. These samples target
**0.1.0-preview.9 or newer**.

| Theme | Intended use |
| --- | --- |
| Workbench | Compact project work and split panes |
| Paper | Spacious white pages and serif reading |
| Focus | Long writing/reading sessions with quieter controls |
| Nord | Familiar low-contrast developer-tool styling |
| Field Notes | Research notebook with ruled headings and serif prose |
| Studio | Visual planning, rounded cards, generous chrome |
| Terminal | Dense monospace work, square controls, muted phosphor colors |
| Editorial | Publication-like typography and expressive headings |
| Soft Focus | Roomier controls and readable everyday planning |
| Blueprint | Technical documentation, crisp hierarchy, structured tables |

The `Base appearance: light` or `dark` comment makes each sample standalone:
it replaces the built-in treatment and sets matching native appearance. Smaller
CSS snippets without that comment overlay the selected preset.
Clear custom CSS to return to the selected preset. All assets/fonts are local or
system-provided; no online font requests are made.

Color tokens are the Theme v1 compatibility contract. CSS selectors allow more
creative customization but may evolve. See `docs/themes.md` for the format.
