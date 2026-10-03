import { vim, Vim, getCM } from '@replit/codemirror-vim';
import { foldedRanges, foldEffect } from '@codemirror/language';
import { headingRanges } from './headings.js';

let recordingOwner;
const foldedCuts = new Map();
function foldedHeadings(cm) {
  const starts = new Set();
  foldedRanges(cm.cm6.state).between(0, cm.cm6.state.doc.length, from => starts.add(from));
  return headingRanges(cm.getValue()).filter(h => starts.has(h.from));
}

function subtreeRanges(cm, args, ranges) {
  if (!args.linewise || cm.state.vim.visualBlock) return ranges;
  const headings = foldedHeadings(cm), source = cm.getValue();
  const expanded = ranges.map(range => {
    let from = cm.indexFromPos(range.anchor), to = cm.indexFromPos(range.head);
    if (from > to) [from, to] = [to, from];
    for (const h of headings) if (from <= h.start && h.start < to) to = Math.max(to, Math.min(source.length, h.to + 1));
    const folds = headings.filter(h => h.start >= from && h.start < to).map(h => h.start - from);
    if (folds.length) {
      foldedCuts.set(source.slice(from, to).replace(/\n?$/, '\n'), folds);
      if (foldedCuts.size > 20) foldedCuts.delete(foldedCuts.keys().next().value);
    }
    return { anchor: cm.posFromIndex(from), head: cm.posFromIndex(to) };
  });
  return expanded;
}
Vim.defineOperator('orbitalDelete', function(cm, args, ranges, ...rest) {
  return this.delete(cm, args, subtreeRanges(cm, args, ranges), ...rest);
});
Vim.mapCommand('d', 'operator', 'orbitalDelete', {});
Vim.defineOperator('orbitalYank', function(cm, args, ranges, ...rest) {
  return this.yank(cm, args, subtreeRanges(cm, args, ranges), ...rest);
});
Vim.mapCommand('y', 'operator', 'orbitalYank', {});

Vim.defineAction('orbitalPaste', function(cm, args, state) {
  const register = Vim.getVimGlobalState_().registerController.getRegister(args.registerName);
  const text = register.toString(), savedFolds = foldedCuts.get(text);
  const normal = !state.visualMode;
  const cursor = cm.getCursor(), heading = normal && register.linewise && args.after
    ? foldedHeadings(cm).find(h => cm.cm6.state.doc.lineAt(h.start).number - 1 === cursor.line) : null;
  const getCursor = cm.getCursor;
  // Native linewise paste inserts after the current source line. For a closed
  // subtree its visible line represents the entire range, not just its title.
  if (heading) cm.getCursor = function() { cm.getCursor = getCursor; return cm.posFromIndex(heading.to); };
  try { this.paste(cm, args, state); }
  finally { cm.getCursor = getCursor; }
  if (savedFolds && normal && register.linewise && args.registerName !== '+') {
    const doc = cm.cm6.state.doc, start = doc.line(cm.getCursor().line + 1).from;
    const starts = new Set();
    for (let i = 0; i < (args.repeat || 1); i++) for (const offset of savedFolds) starts.add(start + i * text.length + offset);
    const ranges = headingRanges(cm.getValue()).filter(h => starts.has(h.start) && h.to > h.from);
    if (ranges.length) cm.cm6.dispatch({ effects: ranges.map(h => foldEffect.of(h)) });
  }
});
for (const [key, after] of [['p', true], ['P', false]]) Vim.mapCommand(key, 'action', 'orbitalPaste', { after }, { isEdit: true });

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
      cm.on('vim-command-done', () => {
        if (cm.state.vim?.insertMode || cm.state.vim?.visualMode) return;
        const pos = cm.indexFromPos(cm.getCursor());
        const heading = foldedHeadings(cm).find(h => pos === h.from || pos === h.to);
        if (heading) cm.setCursor(cm.posFromIndex(Math.max(heading.start, heading.from - 1)));
      });
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
