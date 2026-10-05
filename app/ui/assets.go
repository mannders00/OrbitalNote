package ui

import "embed"

//go:embed index.html style.css app.js api.js editor.js icons.js vi.js document-view.js local-graph.js tab-layout.js dom.js outline.js vendor/*.js vendor/*.css vendor/fonts/*.woff2 task-dialog.js task-destination.js recurrence.js workspace-settings.js calendar.js sync.js mark.svg shortcuts.js appearance.js theme-presets.js agenda-query.js
var Assets embed.FS
