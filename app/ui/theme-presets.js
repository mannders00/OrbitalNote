// Layout treatments are intentionally useful, not hue rotations. Selectors in
// downloadable samples are the same ones used by the built-in presets.
export const themeTreatments = {
  aurora: ['Aurora', 'Deep indigo and luminous mint, paired with a crisp daylight palette.', `
.ui-preview :is(h1,h2,h3) { letter-spacing: -.025em; }
.ui-preview blockquote { border-left-color: var(--accent); background: var(--blue-soft); padding: 12px 18px; }
`],
  ember: ['Ember', 'Warm charcoal and copper after dark; soft porcelain and burnt orange by day.', `
.ui-preview :is(h1,h2) { letter-spacing: -.03em; }
.ui-preview h2 { border-bottom: 1px solid var(--border); padding-bottom: 10px; }
.ui-preview blockquote { border-left: 2px solid var(--accent); }
`],
  iris: ['Iris', 'Inky violet and lavender with a clean, understated studio feel.', `
.ui-preview :is(h1,h2,h3) { letter-spacing: -.025em; font-weight: 600; }
.ui-preview img { border-radius: 10px; }
.ui-preview blockquote { background: var(--blue-soft); padding: 12px 18px; }
`],
  dark: ['Workbench', 'Compact, neutral chrome for project work and split panes.', `
.tab-strip { height: 32px; }
.tree button[data-open] { min-height: 26px; font-size: 12px; }
.document-toolbar { min-height: 36px; }
.ui-preview { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
`],
  light: ['Paper', 'Clean white pages with spacious reading typography.', `
:root { --document-leading: 1.9; }
.ui-preview { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 15px; line-height: 1.8; }
.ui-preview :is(h1,h2,h3) { font-family: -apple-system, sans-serif; letter-spacing: -.025em; }
.tab-strip .tab { border-radius: 9px 9px 0 0; }
.document-toolbar { padding-block: 10px; }
`],
  midnight: ['Focus', 'Quieter controls, generous leading, and calmer reading.', `
:root { --document-size: 15px; --document-leading: 1.95; }
.document-toolbar h1 { opacity: .65; }
.ui-preview { font-size: 17px; line-height: 1.95; }
.ui-preview :is(h1,h2,h3) { font-weight: 500; letter-spacing: -.02em; }
.tree button[data-open] { padding-block: 8px; }
.statusbar { font-size: 10px; }
`],
  nord: ['Nord', 'Cool, low-contrast surfaces with a familiar developer-tool layout.', `
:root { --document-font: "SFMono-Regular", Menlo, Consolas, monospace; }
.ui-preview { font-family: -apple-system, sans-serif; line-height: 1.8; }
button, input, select, textarea { border-radius: 4px; }
.tab-strip .tab { border-radius: 3px 3px 0 0; }
.calendar-event, .timed-event { border-radius: 2px; }
`],
  forest: ['Field Notes', 'A warm notebook for research: serif reading and ruled headings.', `
.ui-preview { font-family: Georgia, serif; font-size: 17px; line-height: 1.85; }
.ui-preview h2 { padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.ui-preview blockquote { border-left: 3px solid var(--accent); font-style: italic; }
.page-heading h1 { font-family: Georgia, serif; font-weight: 500; }
.tag-button, .entry-tag { border-radius: 2px; }
`],
  plum: ['Studio', 'Airy, rounded controls for planning and visual notes.', `
button, input, select, textarea { border-radius: 9px; }
.segmented { border-radius: 12px; padding: 4px; }
.segmented button { border-radius: 8px; }
.tab-strip { height: 40px; }
.tab-strip .tab { border-radius: 12px 12px 0 0; }
.agenda-row { margin-bottom: 8px; background: var(--side); border-radius: 12px; padding-inline: 8px; }
.agenda-entry { border-bottom: 0; }
.ui-preview img { border-radius: 14px; }
`],
  coffee: ['Terminal', 'Base16 Default-inspired neutral grays, muted syntax colors, and dense monospace typography.', `
:root { font-family: "SFMono-Regular", Menlo, Consolas, monospace; --document-leading: 1.65; }
button, input, select, textarea, dialog, .segmented, .segmented button, .tab-strip .tab, .agenda-query-input { border-radius: 0; }
.tab-strip { height: 31px; }
.ui-preview { font-family: "SFMono-Regular", Menlo, Consolas, monospace; font-size: 13px; }
.page-heading h1 { font-size: 21px; font-weight: 500; }
.sidebar-header .panel-title { text-transform: uppercase; letter-spacing: .1em; }
.agenda-entry { padding-block: 9px; }
`],
  sand: ['Editorial', 'A warm publication-like reading experience with expressive serif headings.', `
:root { --document-leading: 1.85; }
.ui-preview { font-family: Georgia, "Times New Roman", serif; font-size: 18px; line-height: 1.85; }
.ui-preview :is(h1,h2) { font-family: Georgia, serif; font-weight: 400; letter-spacing: -.04em; line-height: 1.25; }
.ui-preview h2 { font-size: 2em; }
.ui-preview h3 { font-size: 1.4em; font-weight: 500; }
.ui-preview blockquote { font-size: 1.15em; font-style: italic; border-left: 2px solid var(--accent); padding-left: 20px; }
.page-heading h1 { font-family: Georgia, serif; font-weight: 400; }
.tab-strip .tab { border-radius: 0; }
`],
  rose: ['Soft Focus', 'Readable, roomy controls for relaxed everyday use.', `
:root { font-size: 15px; --document-size: 15px; --document-leading: 1.9; }
button, input, select { min-height: 34px; }
.icon-button { min-height: 30px; }
.tree button[data-open] { min-height: 34px; }
.agenda-entry { padding-block: 17px; }
.ui-preview { font-size: 17px; line-height: 1.9; }
.segmented { padding: 4px; border-radius: 10px; }
`],
  ocean: ['Blueprint', 'Structured technical notes with grid-like tables and crisp headings.', `
.ui-preview :is(h1,h2,h3), .page-heading h1 { font-family: "SFMono-Regular", Menlo, Consolas, monospace; letter-spacing: -.04em; }
.ui-preview h2 { border-bottom: 2px solid var(--accent); padding-bottom: 10px; }
.ui-preview table { border-collapse: collapse; width: 100%; }
.ui-preview :is(th,td) { border: 1px solid var(--border); padding: 8px 12px; }
.tab-strip .tab, button, input, select { border-radius: 2px; }
.ui-preview blockquote { border-left: 3px solid var(--accent); background: var(--side); padding: 12px 18px; }
`],
};

export function themeCSS([id, , mode, bg, side, text, accent]) {
  const [name, description, treatment] = themeTreatments[id];
  // Base16 Default dark accents; deeper companions retain readability on paper.
  const terminal = mode === 'dark'
    ? ['#b8b8b8', '#888888', '#383838', '#ab4642', '#a1b56c', '#f7ca88', '#dc9656', '#ba8baf', '#86c1b9']
    : ['#585858', '#686868', '#d8d8d8', '#ab4642', '#536b2f', '#805d23', '#985c28', '#83557a', '#37776e'];
  const [muted, faint, border, red, green, amber, orange, purple, cyan] = terminal;
  const terminalCSS = id === 'coffee' ? `
:root { --muted:${muted}; --faint:${faint}; --border:${border}; --todo:${red}; --done:${green}; --warn:${amber}; --code:${cyan}; --button:#416f80; --warn-bg:${mode === 'dark' ? '#302a21' : '#f4eadb'}; }
.chroma :is(.k,.kd,.kn,.kt) { color:${purple}; }
.chroma :is(.nf,.nb,.nc) { color:var(--accent); }
.chroma :is(.mi,.mf,.mh) { color:${orange}; }
` : '';
  return `/* OrbitalNote Theme v1: ${name}\n * ${description}\n * Base appearance: ${mode}. Self-contained; paste into Custom theme CSS.\n */
:root { --bg:${bg}; --side:${side}; --ribbon:${side}; --panel:${side}; --text:${text}; --accent:${accent}; --button:${mode === 'dark' ? '#347ed7' : accent}; --muted:color-mix(in srgb, ${text} 65%, ${bg}); --faint:color-mix(in srgb, ${text} 45%, ${bg}); --border:color-mix(in srgb, ${text} 16%, ${bg}); --hover:color-mix(in srgb, ${text} 9%, ${bg}); --selected:color-mix(in srgb, ${accent} 18%, ${bg}); --blue-soft:color-mix(in srgb, ${accent} 12%, ${bg}); --code:${accent}; --todo:${mode === 'dark' ? '#e88787' : '#bd3535'}; --done:${mode === 'dark' ? '#7fc59a' : '#287943'}; --warn:${mode === 'dark' ? '#d4ad73' : '#956726'}; --warn-bg:${mode === 'dark' ? '#352e23' : '#fbf2e3'}; --shadow:${mode === 'dark' ? '#0006' : '#0002'}; color-scheme:${mode}; }
.ui-preview { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 16px; line-height: 1.8; }
${treatment}${terminalCSS}`;
}
