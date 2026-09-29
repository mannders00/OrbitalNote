import { EditorState, EditorSelection, StateField, Compartment } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, keymap, drawSelection, lineNumbers, gutter, GutterMarker } from '@codemirror/view';
import { history, defaultKeymap, undo, redo } from '@codemirror/commands';
import { codeFolding, foldService, foldEffect, unfoldEffect, foldedRanges, unfoldAll } from '@codemirror/language';
import { headingRanges } from './headings.js';

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
    return button;
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
    return button;
  }
  ignoreEvent() { return true; }
}

function decorations(state) {
  const ranges = [], source = state.doc.toString();
  for (const heading of headingRanges(source)) {
    if (heading.to > heading.from) ranges.push(Decoration.widget({ widget: new HeadingFold(heading, isFolded(state, heading.from)), side: -2 }).range(heading.start));
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
      ranges.push(Decoration.line({ class: `org-heading org-h${Math.min(heading[1].length, 6)}` }).range(line.from));
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

export function createEditor(host) {
  let silent = false;
  let numberMode = 'off';
  class RelativeNumber extends GutterMarker {
    constructor(text) { super(); this.text = text; }
    eq(other) { return this.text === other.text; }
    toDOM() { return document.createTextNode(this.text); }
  }
  const numbers = new Compartment();
  const extensions = [history(), drawSelection(), EditorView.lineWrapping,
    numbers.of([]), EditorView.atomicRanges.of(view => foldedRanges(view.state)),
    codeFolding({ placeholderText: '' }),
    foldService.of((state, from) => headingRanges(state.doc.toString()).find(h => h.start === from && h.to > h.from) || null), orgStyle,
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
      if (update.docChanged && !silent) queueMicrotask(() => update.view.contentDOM.dispatchEvent(new Event('editor-input', { bubbles: true })));
      if (update.selectionSet) queueMicrotask(() => update.view.contentDOM.dispatchEvent(new Event('editor-selection')));
    })];
  const view = new EditorView({ parent: host, state: EditorState.create({ extensions }) });
  const editor = view.contentDOM;
  editor.classList.add('ui-source');
  Object.defineProperties(editor, {
    value: { get: () => view.state.doc.toString(), set: value => { silent = true; view.setState(EditorState.create({ doc: value, extensions })); editor.setLineNumbers(numberMode); silent = false; } },
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
  editor.replaceText = (text, from = editor.selectionStart, to = editor.selectionEnd) => { if (!editor.closest('[hidden], [inert]') && editor.getClientRects().length) view.focus(); view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true, userEvent: 'input' }); };
  editor.undo = () => undo(view); editor.redo = () => redo(view);
  editor.foldHeading = action => {
    if (action === 'unfold-all') return unfoldAll(view);
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
  editor.caretRect = () => view.coordsAtPos(view.state.selection.main.head);
  editor.refresh = () => view.requestMeasure();
  editor.viewport = view.scrollDOM;
  editor.dispose = () => view.destroy();
  return editor;
}
