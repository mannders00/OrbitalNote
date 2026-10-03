import { EditorState, EditorSelection, StateField, StateEffect, Compartment } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, keymap, drawSelection, lineNumbers, gutter, GutterMarker } from '@codemirror/view';
import { history, defaultKeymap, undo, redo } from '@codemirror/commands';
import { codeFolding, foldService, foldEffect, unfoldEffect, foldedRanges } from '@codemirror/language';
import { headingRanges } from './headings.js';
import { metadataRanges } from './metadata.js';
import { attachVim } from './vi.js';
import { noteSearch, openNoteSearch } from './search.js';

const metadataLabels = new WeakMap();
function metadataLabel(state, from) {
  let labels = metadataLabels.get(state.doc);
  if (!labels) {
    labels = new Map(metadataRanges(state.doc.toString()).map(range => [range.from, range.label]));
    metadataLabels.set(state.doc, labels);
  }
  return labels.get(from);
}

function isFolded(state, from) {
  let folded = false;
  foldedRanges(state).between(from, from, start => { if (start === from) folded = true; });
  return folded;
}
function foldHeading(view, heading, collapse = !isFolded(view.state, heading.from)) {
  if (heading.to <= heading.from) return false;
  const head = view.state.selection.main.head;
  view.dispatch({ effects: (collapse ? foldEffect : unfoldEffect).of(heading),
    ...(collapse && head > heading.from && head <= heading.to ? { selection: { anchor: heading.start } } : {}) });
  return true;
}
// Keep the widget's cursor geometry at its source position. The button itself
// is positioned in the heading margin; returning it directly makes native
// caret measurement jump to that margin in insert mode.
function headingControl(button) {
  const anchor = document.createElement('span');
  anchor.className = 'editor-heading-control';
  anchor.append(button);
  return anchor;
}
class HeadingFold extends WidgetType {
  constructor(heading, collapsed) { super(); this.heading = heading; this.collapsed = collapsed; }
  eq(other) { return this.collapsed === other.collapsed && this.heading.from === other.heading.from && this.heading.to === other.heading.to && this.heading.title === other.heading.title; }
  toDOM(view) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'editor-heading-fold';
    button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 5 7 7-7 7"/></svg>';
    button.setAttribute('aria-expanded', String(!this.collapsed));
    button.setAttribute('aria-label', `${this.collapsed ? 'Expand' : 'Collapse'} heading: ${this.heading.title}`);
    button.addEventListener('mousedown', e => e.preventDefault());
    button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); foldHeading(view, this.heading); });
    return headingControl(button);
  }
  ignoreEvent() { return true; }
}

class HeadingMenu extends WidgetType {
  constructor(line) { super(); this.line = line; }
  eq(other) { return this.line === other.line; }
  toDOM(view) {
    const button = document.createElement('button');
    button.className = 'heading-menu-button'; button.type = 'button';
    button.setAttribute('aria-label', 'Heading actions'); button.setAttribute('aria-haspopup', 'menu');
    button.textContent = '⋮';
    button.addEventListener('mousedown', e => e.preventDefault());
    button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); view.contentDOM.dispatchEvent(new CustomEvent('heading-menu', { bubbles: true, detail: { line: this.line, button } })); });
    return headingControl(button);
  }
  ignoreEvent() { return true; }
}

class MetadataFold extends WidgetType {
  constructor(range, collapsed) { super(); this.range = range; this.collapsed = collapsed; }
  eq(other) { return this.collapsed === other.collapsed && this.range.from === other.range.from && this.range.to === other.range.to && this.range.label === other.range.label; }
  toDOM(view) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'editor-heading-fold editor-metadata-fold';
    button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 5 7 7-7 7"/></svg>';
    button.setAttribute('aria-expanded', String(!this.collapsed));
    button.setAttribute('aria-label', `${this.collapsed ? 'Expand' : 'Collapse'} ${this.range.label.toLowerCase()}`);
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); foldHeading(view, this.range); });
    return headingControl(button);
  }
  ignoreEvent() { return true; }
}

function decorations(state) {
  const ranges = [], source = state.doc.toString();
  const headings = headingRanges(source), clocked = new Set();
  for (const [index, heading] of headings.entries()) {
    if (/^[ \t]*CLOCK:\s*\[[^\]\n]+\][ \t]*$/m.test(source.slice(heading.start, headings[index+1]?.start ?? source.length))) clocked.add(heading.start);
    if (heading.to > heading.from) ranges.push(Decoration.widget({ widget: new HeadingFold(heading, isFolded(state, heading.from)), side: -2 }).range(heading.start));
  }
  for (const range of metadataRanges(source)) {
    ranges.push(Decoration.widget({ widget: new MetadataFold(range, isFolded(state, range.from)), side: -2 }).range(range.start));
    ranges.push(Decoration.line({ class: 'org-metadata-fold-line' }).range(range.start));
  }
  const keywords = source.match(/^#\+TODO:\s*(.+)$/im)?.[1] || 'TODO | DONE';
  const [pending, finished = 'DONE'] = keywords.split('|');
  const words = text => text.trim().split(/\s+/).map(word => word.replace(/\(.*\)/, ''));
  const done = new Set(words(finished)), states = new Set([...words(pending), ...done]);
  let block = '', drawer = false;
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n), text = line.text;
    const begin = /^\s*#\+begin_(\S+)/i.exec(text);
    if (!block && begin) block = begin[1].toLowerCase();
    if (block) {
      const end = text.trim().toLowerCase() === '#+end_' + block;
      const kind = block === 'quote' ? 'quote' : 'code';
      ranges.push(Decoration.line({ class: `org-block-${kind}${begin || end ? ' org-block-marker' : ''}${begin ? ' org-block-start' : ''}${end ? ' org-block-end' : ''}` }).range(line.from));
      if (end) block = '';
      continue;
    }
    if (drawer || /^\s*:[A-Za-z0-9_]+:\s*$/.test(text)) {
      drawer = text.trim().toUpperCase() !== ':END:';
      ranges.push(Decoration.line({ class: 'org-metadata-line' }).range(line.from));
      if (text.length) ranges.push(Decoration.mark({ class: 'org-meta' }).range(line.from, line.to));
      continue;
    }
    const heading = /^(\*+)\s+(?:(\S+)\s+)?/.exec(text);
    if (heading) {
      ranges.push(Decoration.widget({ widget: new HeadingMenu(n), side: 1 }).range(line.to));
      ranges.push(Decoration.line({ class: `org-heading org-h${Math.min(heading[1].length, 6)}${clocked.has(line.from) ? ' org-clocked' : ''}` }).range(line.from));
      ranges.push(Decoration.mark({ class: 'org-marker' }).range(line.from, line.from + heading[1].length));
      if (states.has(heading[2])) {
        const at = line.from + text.indexOf(heading[2], heading[1].length);
        ranges.push(Decoration.mark({ class: `task-state ${done.has(heading[2]) ? 'org-done' : 'org-todo'}`, attributes: { role: 'button', tabindex: '0', 'data-task-line': String(n), 'aria-label': `${done.has(heading[2]) ? 'Reopen' : 'Complete'} task: ${heading[2]}` } }).range(at, at + heading[2].length));
      }
      const tags = /\s+(:[\w@#%:]+:)\s*$/.exec(text);
      if (tags) ranges.push(Decoration.mark({ class: 'org-tags' }).range(line.from + tags.index + tags[0].indexOf(':'), line.to));
    }
    if (/^\s*(#\+|:)/.test(text) && text.length) {
      ranges.push(Decoration.line({ class: 'org-metadata-line' }).range(line.from));
      ranges.push(Decoration.mark({ class: 'org-meta' }).range(line.from, line.to));
    }
    if (/^\s*(?:SCHEDULED|DEADLINE|CLOSED):/.test(text)) ranges.push(Decoration.line({ class: 'org-planning-line' }).range(line.from));
    if (/^\s*\|/.test(text)) ranges.push(Decoration.line({ class: `org-table-line${/^\s*\|[-+|]+\s*$/.test(text) ? ' org-table-rule' : ''}` }).range(line.from));
    const checkbox = /^\s*(?:[-+]|\d+[.)])\s+\[([ Xx-])\]/.exec(text);
    if (checkbox) {
      const at = line.from + checkbox[0].lastIndexOf('[');
      ranges.push(Decoration.mark({ class: 'source-checkbox', attributes: { 'data-checkbox-line': String(n), role: 'checkbox', tabindex: '0', 'aria-checked': /x/i.test(checkbox[1]) ? 'true' : checkbox[1] === '-' ? 'mixed' : 'false' } }).range(at, at + 3));
    }
    for (const match of text.matchAll(/(^|[\s(])([*\/_+~=])([^\s\n](?:.*?[^\s\n])?)\2(?=$|[\s.,!?;:)])/g)) {
      const at = line.from + match.index + match[1].length, end = at + match[0].length - match[1].length;
      const cls = { '*': 'org-bold', '/': 'org-italic', '_': 'org-underline', '+': 'org-strike', '~': 'org-code', '=': 'org-code' }[match[2]];
      ranges.push(Decoration.mark({ class: cls }).range(at, end));
      ranges.push(Decoration.mark({ class: 'org-format-marker' }).range(at, at + 1), Decoration.mark({ class: 'org-format-marker' }).range(end - 1, end));
    }
    for (const match of text.matchAll(/\[\[[^\]]+\](?:\[[^\]]*\])?\]|[<\[]\d{4}-\d{2}-\d{2}[^>\]\n]*[>\]]/g)) ranges.push(Decoration.mark({ class: match[0].startsWith('[[') ? 'org-link' : 'org-time' }).range(line.from + match.index, line.from + match.index + match[0].length));
  }
  return Decoration.set(ranges, true);
}
const orgStyle = StateField.define({ create: decorations, update: (value, transaction) => transaction.docChanged || foldedRanges(transaction.startState) !== foldedRanges(transaction.state) ? decorations(transaction.state) : value, provide: field => EditorView.decorations.from(field) });
const jumpEffect = StateEffect.define();
const jumpHighlight = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    if (tr.docChanged || tr.selection) value = Decoration.none;
    for (const effect of tr.effects) if (effect.is(jumpEffect)) value = effect.value == null ? Decoration.none : Decoration.set([Decoration.line({class:'org-jump-highlight'}).range(tr.state.doc.lineAt(effect.value).from)]);
    return value;
  },
  provide: field => EditorView.decorations.from(field),
});

export function createEditor(host) {
  let silent = false;
  let numberMode = 'off';
  class RelativeNumber extends GutterMarker {
    constructor(text) { super(); this.text = text; }
    eq(other) { return this.text === other.text; }
    toDOM() { return document.createTextNode(this.text); }
  }
  const numbers = new Compartment(), vi = new Compartment();
  let viAdapter;
  const extensions = [vi.of([]), history(), drawSelection(), EditorView.lineWrapping, jumpHighlight, noteSearch,
    EditorView.scrollMargins.of(view => view.state.selection.main.head >= view.state.doc.line(view.state.doc.lines).from ? { bottom: view.scrollDOM.clientHeight / 2 } : {}),
    numbers.of([]), EditorView.atomicRanges.of(view => foldedRanges(view.state)),
    codeFolding({ preparePlaceholder: (state, range) => metadataLabel(state, range.from),
      placeholderDOM(view, onclick, label) {
      const placeholder = document.createElement('span'); placeholder.className = 'cm-foldPlaceholder' + (label ? ' editor-metadata-placeholder' : '');
      placeholder.textContent = label ? `${label} …` : '…';
      placeholder.setAttribute('aria-label', label ? `Expand ${label.toLowerCase()}` : 'Expand folded heading');
      placeholder.setAttribute('role', 'button'); placeholder.tabIndex = 0;
      placeholder.onclick = onclick;
      placeholder.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onclick(event); } };
      return placeholder;
    } }),
    foldService.of((state, from) => [...headingRanges(state.doc.toString()), ...metadataRanges(state.doc.toString())].find(h => h.start === from && h.to > h.from) || null), orgStyle,
    EditorView.domEventHandlers({ click(event, view) {
      const box = event.target.closest('[data-checkbox-line]'); if (box) { event.preventDefault(); view.contentDOM.dispatchEvent(new CustomEvent('checkbox-toggle', { bubbles: true, detail: { line: Number(box.dataset.checkboxLine) } })); return true; }
      const task = event.target.closest('[data-task-line]'); if (!task) return false;
      event.preventDefault(); view.contentDOM.dispatchEvent(new CustomEvent('task-toggle', { bubbles: true, detail: { line: Number(task.dataset.taskLine) } })); return true;
    }, keydown(event, view) {
      const box = event.target.closest('[data-checkbox-line]'); if (box && ['Enter', ' '].includes(event.key)) { event.preventDefault(); box.click(); return true; }
      const task = event.target.closest('[data-task-line]'); if (!task || !['Enter', ' '].includes(event.key)) return false;
      event.preventDefault(); view.contentDOM.dispatchEvent(new CustomEvent('task-toggle', { bubbles: true, detail: { line: Number(task.dataset.taskLine) } })); return true;
    }, drop(event) {
      // Pane tab drops belong to TabLayout, not the editor's text-drop handler.
      if (event.dataTransfer?.types.includes('application/x-orbitalnote-tab')) { event.preventDefault(); return true; }
      return false;
    } }),
    keymap.of([{ key: 'Enter', run(view) {
      const selection = view.state.selection.main; if (!selection.empty) return false;
      const line = view.state.doc.lineAt(selection.head), match = /^(\s*)([-+*]|\d+[.)])[ \t]+(\[[ Xx-]\][ \t]*)?(.*)$/.exec(line.text);
      // A column-zero star is an Org heading, not a list bullet.
      if (!match || (match[2] === '*' && !match[1]) || selection.head < line.to - match[4].length) return false;
      if (!match[4]) { view.dispatch({ changes: { from: line.from, to: line.to, insert: '' }, userEvent: 'input' }); return true; }
      const marker = /^\d/.test(match[2]) ? String(parseInt(match[2]) + 1) + match[2].slice(-1) : match[2];
      const insert = '\n' + match[1] + marker + (match[3] ? ' [ ] ' : ' ');
      view.dispatch({ changes: { from: selection.head, insert }, selection: { anchor: selection.head + insert.length }, scrollIntoView: true, userEvent: 'input' }); return true;
    } }, ...defaultKeymap]),
    EditorView.contentAttributes.of({ class: 'ui-source', 'aria-label': 'Org source editor', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off', autocomplete: 'off', 'data-ui': 'source' }),
    EditorView.updateListener.of(update => {
      if (update.docChanged && !silent) {
        const changes = [];
        update.changes.iterChanges((from, to, _fromB, _toB, insert) => changes.push({ from, to, insert: insert.toString() }));
        const detail = { before: update.startState.doc.toString(), after: update.state.doc.toString(), changes };
        queueMicrotask(() => update.view.contentDOM.dispatchEvent(new CustomEvent('editor-input', { bubbles: true, detail })));
      }
      if (update.selectionSet) queueMicrotask(() => update.view.contentDOM.dispatchEvent(new Event('editor-selection')));
    })];
  const view = new EditorView({ parent: host, state: EditorState.create({ extensions }) });
  const editor = view.contentDOM;
  editor.classList.add('ui-source');
  Object.defineProperties(editor, {
    value: { get: () => view.state.doc.toString(), set: value => { silent = true; viAdapter?.beforeReset(); view.setState(EditorState.create({ doc: value, extensions })); editor.setLineNumbers(numberMode); viAdapter?.restore(); editor.setMetadataFolds(metadataRanges(editor.value).map(range => range.start)); silent = false; } },
    selectionStart: { get: () => view.state.selection.main.from },
    selectionEnd: { get: () => view.state.selection.main.to },
    selectionDirection: { get: () => view.state.selection.main.anchor > view.state.selection.main.head ? 'backward' : 'forward' },
    scrollTop: { get: () => view.scrollDOM.scrollTop, set: value => { view.scrollDOM.scrollTop = value; } },
    scrollLeft: { get: () => view.scrollDOM.scrollLeft, set: value => { view.scrollDOM.scrollLeft = value; } },
  });
  editor.setSelectionRange = (from, to, direction) => {
    const clamp = n => Math.max(0, Math.min(view.state.doc.length, n));
    foldedRanges(view.state).between(0, view.state.doc.length, (start, end) => {
      if (from > start && from <= end) from = from >= view.state.selection.main.head ? Math.min(end + 1, view.state.doc.length) : start;
      if (to > start && to <= end) to = from;
    });
    view.dispatch({ selection: EditorSelection.single(clamp(direction === 'backward' ? to : from), clamp(direction === 'backward' ? from : to)) });
  };
  editor.replaceText = (text, from = editor.selectionStart, to = editor.selectionEnd) => { const visible = !editor.closest('[hidden], [inert]') && !!editor.getClientRects().length; if (visible) view.focus(); view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: visible, userEvent: 'input' }); };
  editor.jumpTo = position => {
    const pos = Math.max(0, Math.min(view.state.doc.length, position)), effects = [];
    foldedRanges(view.state).between(0, view.state.doc.length, (from,to) => { if (from < pos && pos <= to) effects.push(unfoldEffect.of({from,to})); });
    effects.push(jumpEffect.of(pos), EditorView.scrollIntoView(pos, {y:'center'}));
    view.dispatch({effects, selection:EditorSelection.create([EditorSelection.cursor(pos,1)])});
  };
  const clearJump = () => { if (view.state.field(jumpHighlight).size) view.dispatch({effects:jumpEffect.of(null)}); };
  document.addEventListener('pointerdown', clearJump);
  document.addEventListener('keydown', clearJump);
  view.scrollDOM.addEventListener('wheel', clearJump, {passive:true});
  editor.undo = () => undo(view); editor.redo = () => redo(view);
  editor.attachVi = status => (viAdapter = attachVim(view, vi, status));
  editor.openSearch = replace => openNoteSearch(view, replace);
  editor.getHeadingFolds = () => headingRanges(editor.value).filter(h => isFolded(view.state, h.from)).map(h => h.start);
  editor.metadataRanges = () => metadataRanges(editor.value).map(range => ({ ...range, folded: isFolded(view.state, range.from) }));
  editor.getMetadataFolds = () => editor.metadataRanges().filter(range => range.folded).map(range => range.start);
  editor.setMetadataFolds = starts => {
    const selected = new Set(starts), ranges = metadataRanges(editor.value), effects = [];
    for (const range of ranges) effects.push((selected.has(range.start) ? foldEffect : unfoldEffect).of(range));
    const parent = ranges.find(range => selected.has(range.start) && range.from < view.state.selection.main.head && range.to >= view.state.selection.main.head);
    view.dispatch({ effects, ...(parent ? { selection: { anchor: parent.start } } : {}) });
  };
  editor.setHeadingFolds = starts => {
    const selected = new Set(starts), headings = headingRanges(editor.value), effects = [];
    const headingEnds = new Set(headings.map(h => h.from));
    foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => { if (headingEnds.has(from)) effects.push(unfoldEffect.of({ from, to })); });
    const collapsed = headings.filter(h => selected.has(h.start) && h.to > h.from);
    effects.push(...collapsed.map(h => foldEffect.of(h)));
    const parent = collapsed.find(h => h.from < view.state.selection.main.head && h.to >= view.state.selection.main.head);
    view.dispatch({ effects, ...(parent ? { selection: { anchor: parent.start } } : {}) });
  };
  editor.captureViewport = () => {
    const bounds = view.scrollDOM.getBoundingClientRect(), content = editor.getBoundingClientRect();
    const pos = view.posAtCoords({ x: content.left + parseFloat(getComputedStyle(editor).paddingLeft) + 5, y: bounds.top + Math.min(24, bounds.height / 4) }, false) ?? 0;
    const rect = view.coordsAtPos(pos);
    return { pos, offset: rect ? rect.top - bounds.top : 0, scroll: view.scrollDOM.scrollTop };
  };
  editor.restoreViewport = (anchor, restored = () => {}) => {
    if (!anchor.relocate && anchor.scroll != null) {
      view.scrollDOM.scrollTop = anchor.scroll;
      view.requestMeasure({ key: editor, read: () => anchor.scroll, write: scroll => { if (editor.getClientRects().length) { view.scrollDOM.scrollTop = scroll; restored(); } } });
      return;
    }
    const pos = Math.max(0, Math.min(view.state.doc.length, Math.round(anchor.pos)));
    if (anchor.relocate) editor.setSelectionRange(pos, pos);
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 0 }) });
    view.requestMeasure({ key: editor, read: () => view.coordsAtPos(pos), write: rect => {
      if (rect && editor.getClientRects().length) view.scrollDOM.scrollTop += rect.top - view.scrollDOM.getBoundingClientRect().top - anchor.offset;
      restored();
    } });
  };
  editor.foldHeading = action => {
    if (action === 'unfold-all') { editor.setHeadingFolds([]); return true; }
    const headings = headingRanges(view.state.doc.toString()).filter(h => h.to > h.from);
    if (action === 'fold-all') {
      const head = view.state.selection.main.head;
      const parent = headings.find(h => h.from < head && h.to >= head);
      view.dispatch({ effects: headings.map(h => foldEffect.of(h)), ...(parent ? { selection: { anchor: parent.start } } : {}) });
      return headings.length > 0;
    }
    const head = view.state.selection.main.head;
    const heading = headings.find(h => h.start <= head && h.from >= head) || headings.filter(h => h.start <= head && h.to >= head).at(-1);
    if (!heading) return false;
    return foldHeading(view, heading, action === 'fold' ? true : action === 'unfold' ? false : undefined);
  };
  editor.reveal = () => view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'nearest' }) });
  editor.scrollVi = (direction, halfPage, count = 1) => {
    const scroller = view.scrollDOM, head = view.state.selection.main.head;
    const caret = view.coordsAtPos(head), bounds = scroller.getBoundingClientRect();
    const amount = direction * count * (halfPage ? scroller.clientHeight / 2 : view.defaultLineHeight);
    const top = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + amount));
    const delta = top - scroller.scrollTop;
    if (caret && delta) {
      const y = (caret.top + caret.bottom) / 2, inset = (caret.bottom - caret.top) / 2;
      const target = halfPage ? y + delta : Math.max(bounds.top + inset, Math.min(bounds.bottom - inset, y - delta)) + delta;
      if (Math.abs(target - y) > .5) {
        const next = view.posAtCoords({ x: caret.left, y: target }, false);
        if (next != null) view.dispatch({ selection: { anchor: next }, userEvent: 'select' });
      }
    }
    scroller.scrollTop = top;
  };
  editor.setLineNumbers = mode => {
    numberMode = mode;
    view.dispatch({ effects: numbers.reconfigure(mode === 'off' ? [] : mode !== 'relative' ? lineNumbers() : gutter({
      class: 'cm-lineNumbers',
      lineMarker(view, line) { const number = view.state.doc.lineAt(line.from).number, current = view.state.doc.lineAt(view.state.selection.main.head).number; return new RelativeNumber(String(Math.abs(number - current) || number)); },
      lineMarkerChange: update => update.selectionSet || update.docChanged,
      initialSpacer: view => new RelativeNumber(String(view.state.doc.lines)),
      updateSpacer: (spacer, update) => new RelativeNumber(String(update.state.doc.lines)),
    })) });
  };
  editor.caretRect = () => { const head = view.state.selection.main.head; return view.coordsAtPos(head, head === view.state.doc.lineAt(head).from ? 1 : -1); };
  editor.refresh = () => view.requestMeasure();
  editor.viewport = view.scrollDOM;
  const tail = new ResizeObserver(() => {
    if (view.scrollDOM.clientHeight) { editor.style.setProperty('--document-tail', `${view.scrollDOM.clientHeight / 2}px`); view.requestMeasure(); }
  });
  tail.observe(view.scrollDOM);
  editor.dispose = () => { tail.disconnect(); document.removeEventListener('pointerdown', clearJump); document.removeEventListener('keydown', clearJump); view.destroy(); };
  return editor;
}
