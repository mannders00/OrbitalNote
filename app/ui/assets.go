package ui

import "embed"

//go:embed index.html style.css app.js api.js editor.js icons.js vi.js tab-layout.js vendor/*.js task-dialog.js calendar.js
var Assets embed.FS
