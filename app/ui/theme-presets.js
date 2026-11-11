// Each treatment is a complete visual direction, shared with the standalone
// CSS exports. Workbench and Terminal intentionally retain their original CSS.
export const themeTreatments = {
  dark: ['Workbench', 'Compact, neutral chrome for project work and split panes.', `
.tab-strip { height: 32px; }
.tree button[data-open] { min-height: 26px; font-size: 12px; }
.document-toolbar { min-height: 36px; }
.ui-preview { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
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
  sand: ['Editorial', 'For writers and long-form readers: book typography, a measured reading column, ink rules, and warm paper.', `
:root { --document-size: 15px; --document-leading: 1.85; }
button, input, select, textarea { border-radius: 3px; }
.tab-strip { height: 38px; padding: 0 8px; gap: 0; background: var(--bg); border-bottom: 1px solid var(--border); }
.tab-strip .tab { border-radius: 0; }
.tab-strip .tab.active { border: 0; box-shadow: inset 0 -2px var(--text); }
.tab-strip button[data-tab-select] { font-family: Georgia, serif; font-size: 13px; }
.sidebar-header .panel-title, .ui-context .section-label { font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
.tree button[data-open] { min-height: 31px; border-radius: 0; }
.tree button[data-open].active { background: transparent; color: var(--accent); box-shadow: inset 2px 0 var(--accent); }
.document-toolbar { margin-inline: 20px; padding-inline: 0; min-height: 44px; border-bottom: 1px solid var(--border); }
.document-toolbar h1 { font-size: 11px; letter-spacing: .04em; }
.ui-preview { font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif; font-size: 18px; line-height: 1.85; }
.ui-preview, .ui-panes[data-mode="preview"] .ui-preview { padding-top: 32px; padding-left: max(60px, calc((100% - 66ch) / 2)); padding-right: max(24px, calc((100% - 66ch) / 2)); }
.ui-preview :is(h1,h2,h3,h4) { font-family: Georgia, serif; font-weight: 400; letter-spacing: -.035em; line-height: 1.25; text-wrap: pretty; }
.ui-preview :is(h1,h2) { font-size: 1.9em; }
.ui-preview h3 { font-size: 1.45em; }
.ui-preview p { text-wrap: pretty; }
.ui-preview blockquote { margin-block: 1.7em; padding: 16px 0; border-inline: 0; border-block: 1px solid var(--border); font-size: 1.1em; font-style: italic; color: var(--text); }
.ui-preview :is(pre, details, img) { border-radius: 2px; }
.ui-preview table { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; }
.ui-preview th { background: transparent; border-bottom: 2px solid var(--text); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.page-heading h1 { font-family: Georgia, serif; font-size: 28px; font-weight: 400; letter-spacing: -.04em; }
.agenda-group > h2 { font-family: Georgia, serif; font-size: 16px; font-weight: 400; }
.entry-main strong { font-family: Georgia, serif; font-size: 16px; font-weight: 400; }
.entry-tag, .segmented, .segmented button { border-radius: 2px; }
#calendar-grid { border-radius: 2px; }
.weekday, .time-day-headers > button { font-family: Georgia, serif; }
.query-popup, #modal.task-modal { border-radius: 4px; }
.query-header strong, .modal-heading h2 { font-family: Georgia, serif; font-weight: 400; }
@container (max-width: 600px) {
  .document-toolbar { margin-inline: 12px; }
  .ui-preview { font-size: 17px; }
  .entry-main strong { font-size: 14px; }
}
`],
  plum: ['Studio', 'For visual planners: floating tabs, rounded task cards, a framed writing surface, and expressive violet accents.', `
:root { font-family: "Avenir Next", "Segoe UI", sans-serif; --document-leading: 1.8; }
button, input, select, textarea { border-radius: 9px; }
.tab-strip { height: 44px; padding: 5px 7px; gap: 6px; background: var(--side); }
.tab-strip .tab { border: 1px solid transparent; border-radius: 10px; }
.tab-strip .tab.active, .tab-group.focused > .tab-strip .tab.active { background: var(--panel); border: 1px solid var(--border); box-shadow: 0 2px 5px var(--shadow); }
.sidebar-header .panel-title { font-size: 13px; font-weight: 650; color: var(--accent); }
.tree button[data-open] { min-height: 34px; margin-block: 3px; border-radius: 8px; }
.tree button[data-open].active { color: var(--accent); background: var(--blue-soft); }
.ui-document { background: var(--side); }
.document-toolbar { min-height: 48px; }
.document-main { margin: 0 12px 12px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); overflow: hidden; }
.ui-preview, .source-pane .cm-editor, .source-pane .cm-editor .cm-gutters { background: var(--panel); }
.ui-preview { font-family: "Avenir Next", "Segoe UI", sans-serif; font-size: 16px; line-height: 1.8; }
.ui-preview :is(h1,h2,h3) { font-weight: 700; letter-spacing: -.035em; }
.ui-preview blockquote { border: 0; border-radius: 12px; background: var(--blue-soft); padding: 16px 20px; color: var(--text); }
.ui-preview :is(pre, img) { border-radius: 12px; }
.ui-preview th { background: var(--blue-soft); color: var(--text); }
.statusbar { background: var(--panel); }
.segmented { border-radius: 12px; padding: 3px; }
.segmented button { border-radius: 8px; }
.page-heading h1 { font-size: 28px; font-weight: 700; letter-spacing: -.045em; }
.agenda-group > h2 { border-bottom: 0; font-size: 14px; font-weight: 650; }
.agenda-row { margin-bottom: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding-inline: 8px; }
.agenda-row:hover, .agenda-row:focus-within { background: var(--panel); border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); box-shadow: 0 3px 10px var(--shadow); }
.entry-main strong { font-weight: 600; }
.entry-tag { border-radius: 6px; }
#calendar-grid { border-radius: 12px; background: var(--panel); }
.calendar-event, .timed-event { border-radius: 6px; }
.query-popup, #modal.task-modal { border-radius: 16px; }
@container (max-width: 600px) {
  .document-main { margin: 0 6px 6px; border-radius: 10px; }
  .agenda-row { padding-inline: 4px; }
}
`],
  midnight: ['Focus', 'For unhurried reading and everyday planning: larger type, open spacing, quiet navigation, and clearly visible controls.', `
:root { --document-size: 15px; --document-leading: 1.95; }
button, input, select, textarea { border-radius: 10px; }
#ribbon { background: var(--bg); }
.tab-strip { height: 44px; padding: 4px 8px 0; gap: 8px; background: var(--bg); border-bottom: 1px solid var(--border); }
.tab-strip .tab { border-radius: 0; }
.tab-strip .tab.active { border: 0; box-shadow: inset 0 -3px var(--accent); }
.tab-strip button[data-tab-select] { font-size: 13px; }
.sidebar-header .panel-title { font-size: 14px; font-weight: 500; color: var(--text); }
.tree { padding-top: 14px; }
.tree button[data-open] { min-height: 38px; margin-block: 3px; border-radius: 10px; font-size: 14px; }
.tree button[data-open].active { background: var(--blue-soft); color: var(--text); }
.document-toolbar { min-height: 52px; }
.document-toolbar .actions > button:not(.icon-button) { min-height: 36px; }
.document-toolbar h1 { font-size: 13px; color: var(--text); }
.ui-preview { font-size: 18px; line-height: 1.95; }
.ui-preview, .ui-panes[data-mode="preview"] .ui-preview { padding-top: 32px; padding-left: max(60px, calc((100% - 62ch) / 2)); padding-right: max(24px, calc((100% - 62ch) / 2)); }
.ui-preview :is(h1,h2,h3,h4) { font-weight: 500; letter-spacing: -.02em; line-height: 1.5; }
.ui-preview :is(h1,h2) { font-size: 1.5em; }
.ui-preview li { margin-block: .6em; }
.ui-preview blockquote { border-left: 2px solid var(--accent); padding-left: 22px; color: var(--text); }
.ui-preview th { background: transparent; color: var(--text); }
.ui-context button:not(.icon-button) { padding-block: 9px; font-size: 13px; }
.setting :is(select, input:not([type="checkbox"])) { min-height: 42px; font-size: 14px; }
.page-heading h1 { font-size: 26px; font-weight: 500; letter-spacing: -.03em; }
.agenda-group > h2 { border-bottom: 0; font-size: 14px; }
.agenda-row { margin-block: 5px; border-bottom: 0; }
.entry-main strong { font-size: 15px; line-height: 1.6; font-weight: 500; }
.segmented { border: 0; background: var(--side); padding: 4px; border-radius: 10px; }
.segmented button { border-radius: 7px; }
.query-popup, #modal.task-modal { border-radius: 12px; }
@container (max-width: 600px) {
  .ui-preview { font-size: 17px; }
  .entry-main strong { font-size: 14px; }
}
`],
  ocean: ['Blueprint', 'For structured thinking: strong rules, square controls, monospaced labels, bold headings, and precise technical tables.', `
:root { --document-leading: 1.75; --border: color-mix(in srgb, var(--text) 30%, var(--bg)); }
button, input, select, textarea, .segmented, .segmented button { border-radius: 2px; }
.tab-strip { height: 40px; padding: 0 5px; gap: 0; background: var(--side); border-bottom: 2px solid var(--text); }
.tab-strip .tab { border-radius: 0; border-right: 1px solid var(--border); }
.tab-strip .tab.active { border: 0; border-right: 1px solid var(--border); box-shadow: inset 0 3px var(--accent); }
.tab-strip button[data-tab-select], .panel-title, .section-label, .document-toolbar h1, .statusbar { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; }
.sidebar-header .panel-title, .section-label { font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.tree button[data-open] { min-height: 30px; border-radius: 0; }
.tree button[data-open].active { color: var(--text); background: var(--blue-soft); box-shadow: inset 3px 0 var(--accent); }
.document-toolbar { min-height: 44px; border-bottom: 1px solid var(--border); background: var(--side); }
.document-toolbar h1 { font-size: 11px; }
.ui-preview { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 16px; line-height: 1.75; }
.ui-preview :is(h1,h2,h3) { font-weight: 750; letter-spacing: -.035em; }
.ui-preview :is(h1,h2) { padding-block: 10px; border-top: 2px solid var(--text); border-bottom: 1px solid var(--border); }
.ui-preview pre { border-radius: 0; border-left: 3px solid var(--accent); padding: 12px 16px; }
.ui-preview :is(details, img) { border-radius: 0; }
.ui-preview blockquote { border: 1px solid var(--border); border-left: 3px solid var(--accent); background: var(--side); padding: 12px 18px; color: var(--text); }
.ui-preview :is(th,td) { border: 1px solid var(--border); padding: 9px 12px; }
.ui-preview th { font: 600 11px/1.6 ui-monospace, monospace; letter-spacing: .04em; text-transform: uppercase; background: var(--blue-soft); color: var(--text); }
.ui-preview tbody tr:nth-child(even) { background: color-mix(in srgb, var(--side) 50%, transparent); }
.page-heading h1 { font-weight: 750; letter-spacing: -.04em; }
.agenda-group > h2 { padding: 8px; border-block: 1px solid var(--border); background: var(--side); font: 600 11px/1.5 ui-monospace, monospace; letter-spacing: .07em; text-transform: uppercase; }
.agenda-row { border-bottom-color: var(--border); }
.entry-main strong { font-weight: 650; }
.entry-date { font-family: ui-monospace, monospace; font-size: 11px; }
#calendar-grid { border: 2px solid var(--text); border-radius: 0; }
.weekday, .time-day-headers > button { font-family: ui-monospace, monospace; font-size: 11px; }
.calendar-event, .timed-event, .entry-tag { border-radius: 2px; }
.query-popup { border-width: 2px; border-radius: 2px; box-shadow: 4px 4px 0 var(--border); }
#modal.task-modal, #modal.task-modal #modal-body :is(input, select) { border-radius: 2px; }
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
  const surfaces = {
    sand: [bg, mode === 'dark' ? '#82523f' : accent],
    plum: [mode === 'dark' ? '#2b2537' : '#ffffff', mode === 'dark' ? '#7350a8' : accent],
    midnight: [bg, mode === 'dark' ? '#3c7157' : accent],
    ocean: [bg, mode === 'dark' ? '#285d86' : accent],
  }[id];
  const presentation = surfaces ? `
:root { --panel:${surfaces[0]}; --button:${surfaces[1]}; --muted:color-mix(in srgb, var(--text) 74%, var(--bg)); --faint:color-mix(in srgb, var(--text) 60%, var(--bg)); }
@container (max-width: 420px) {
  :is(#agenda, #calendar) .page-heading h1 { font-size: 20px; }
}
` : '';
  return `/* OrbitalNote Theme v1: ${name}\n * ${description}\n * Base appearance: ${mode}. Self-contained; paste into Custom theme CSS.\n */
:root { --bg:${bg}; --side:${side}; --ribbon:${side}; --panel:${side}; --text:${text}; --accent:${accent}; --button:${mode === 'dark' ? '#347ed7' : accent}; --muted:color-mix(in srgb, ${text} 65%, ${bg}); --faint:color-mix(in srgb, ${text} 45%, ${bg}); --border:color-mix(in srgb, ${text} 16%, ${bg}); --hover:color-mix(in srgb, ${text} 9%, ${bg}); --selected:color-mix(in srgb, ${accent} 18%, ${bg}); --blue-soft:color-mix(in srgb, ${accent} 12%, ${bg}); --code:${accent}; --todo:${mode === 'dark' ? '#e88787' : '#bd3535'}; --done:${mode === 'dark' ? '#7fc59a' : '#287943'}; --warn:${mode === 'dark' ? '#d4ad73' : '#956726'}; --warn-bg:${mode === 'dark' ? '#352e23' : '#fbf2e3'}; --shadow:${mode === 'dark' ? '#0006' : '#0002'}; color-scheme:${mode}; }
.ui-preview { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 16px; line-height: 1.8; }
${treatment}${terminalCSS}${presentation}`;
}
