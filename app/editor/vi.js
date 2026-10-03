import { vim, Vim, getCM } from '@replit/codemirror-vim';

let recordingOwner;

// Relative gutters count source lines. The upstream motion consults findPosV
// to skip folded rows, which makes a count overshoot the gutter's destination.
// Keep its column/operator semantics, but use source coordinates for j/k.
function sourceLines(cm, head, args, state) {
  const findPosV = cm.findPosV;
  if (state.lastMotion === sourceLines) state.lastMotion = this.moveByLines;
  cm.findPosV = (start, amount) => ({ line: Math.max(cm.firstLine(), Math.min(cm.lastLine(), start.line + amount)), ch: start.ch });
  try { return this.moveByLines(cm, head, args, state); }
  finally { cm.findPosV = findPosV; }
}
Vim.defineMotion('orbitalSourceLines', sourceLines);
for (const [keys, forward] of [['j', true], ['k', false]]) {
  Vim.mapCommand(keys, 'motion', 'orbitalSourceLines', { forward, linewise: true });
}

// Use the editor's transaction-aware Vim implementation for composed commands,
// repeat, registers, and macros; map folding to OrbitalNote's Org headings.
for (const [keys, action] of [['za', 'toggle'], ['zo', 'unfold'], ['zc', 'fold'], ['zR', 'unfold-all'], ['zM', 'fold-all']]) {
  const name = 'orbitalFold' + keys;
  Vim.defineAction(name, cm => cm.cm6.contentDOM.foldHeading(action));
  Vim.mapCommand(keys, 'action', name, {}, { context: 'normal' });
}

export function attachVim(view, compartment, status) {
  let enabled = false;
  function report() {
    const cm = getCM(view), state = cm?.state.vim;
    const mode = state?.mode || 'normal';
    view.contentDOM.dataset.viMode = enabled ? mode : '';
    status.hidden = !enabled;
    if (enabled) status.textContent = `${mode.toUpperCase()}${state?.status ? ' · ' + state.status : ''}`;
  }
  function configure() {
    view.dispatch({ effects: compartment.reconfigure(enabled ? vim({ status: false }) : []) });
    const cm = getCM(view);
    if (cm) {
      for (const event of ['vim-mode-change', 'vim-command-done', 'vim-keypress']) cm.on(event, report);
      cm.on('dialog', () => {
        if (cm.state.dialog?.textContent.startsWith('recording @')) recordingOwner = cm;
      });
    }
    report();
  }
  function stopRecording() {
    // The pinned adapter exposes session registers through this API. Do not
    // leave a recording attached to an editor that is about to be destroyed.
    const macro = Vim.getVimGlobalState_().macroModeState;
    if (recordingOwner === getCM(view) && macro.isRecording) macro.exitMacroRecordMode();
  }
  return {
    setEnabled(value) { if (enabled === value && !!getCM(view) === value) return; if (!value) stopRecording(); enabled = value; configure(); },
    restore: configure,
    beforeReset: stopRecording,
    reset() { const cm = getCM(view); if (cm) Vim.handleKey(cm, '<Esc>', 'user'); report(); },
    reveal: () => view.contentDOM.reveal(),
    dispose: stopRecording,
  };
}
