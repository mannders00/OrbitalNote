import { EditorState, EditorSelection, StateField } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, keymap, drawSelection } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, undo, redo } from '@codemirror/commands';

class TaskBox extends WidgetType {
  constructor(line, done) { super(); this.line = line; this.done = done; }
  eq(other) { return this.line === other.line && this.done === other.done; }
  toDOM(view) {
    const button = document.createElement('button');
    button.className = 'editor-task-box'; button.type = 'button';
    button.setAttribute('role', 'checkbox'); button.setAttribute('aria-checked', String(this.done));
    button.setAttribute('aria-label', this.done ? 'Reopen task' : 'Complete task');
    button.textContent = this.done ? '✓' : '';
    button.addEventListener('mousedown', e => e.preventDefault());
    button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); view.contentDOM.dispatchEvent(new CustomEvent('task-toggle', { bubbles: true, detail: { line: this.line } })); });
    return button;
  }
  ignoreEvent() { return true; }
}

function decorations(state) {
  const ranges = [], source = state.doc.toString();
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
      ranges.push(Decoration.line({ class: `org-heading org-h${Math.min(heading[1].length, 6)}` }).range(line.from));
      ranges.push(Decoration.mark({ class: 'org-marker' }).range(line.from, line.from + heading[1].length));
      if (states.has(heading[2])) {
        const at = line.from + text.indexOf(heading[2], heading[1].length);
        ranges.push(Decoration.widget({ widget: new TaskBox(n, done.has(heading[2])), side: -1 }).range(at));
        ranges.push(Decoration.mark({ class: done.has(heading[2]) ? 'org-done' : 'org-todo' }).range(at, at + heading[2].length));
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
const orgStyle = StateField.define({ create: decorations, update: (value, transaction) => transaction.docChanged ? decorations(transaction.state) : value, provide: field => EditorView.decorations.from(field) });

export function createEditor(host) {
  let silent = false;
  const extensions = [history(), drawSelection(), EditorView.lineWrapping, orgStyle,
    EditorView.domEventHandlers({ drop(event) {
      // Pane tab drops belong to TabLayout, not the editor's text-drop handler.
      if (event.dataTransfer?.types.includes('application/x-orbitalnote-tab')) { event.preventDefault(); return true; }
      return false;
    } }),
    keymap.of([...historyKeymap, ...defaultKeymap]),
    EditorView.contentAttributes.of({ class: 'ui-source', 'aria-label': 'Org source editor', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off', autocomplete: 'off', 'data-ui': 'source' }),
    EditorView.updateListener.of(update => {
      if (update.docChanged && !silent) queueMicrotask(() => update.view.contentDOM.dispatchEvent(new Event('editor-input', { bubbles: true })));
      if (update.selectionSet) queueMicrotask(() => update.view.contentDOM.dispatchEvent(new Event('editor-selection')));
    })];
  const view = new EditorView({ parent: host, state: EditorState.create({ extensions }) });
  const editor = view.contentDOM;
  editor.classList.add('ui-source');
  Object.defineProperties(editor, {
    value: { get: () => view.state.doc.toString(), set: value => { silent = true; view.setState(EditorState.create({ doc: value, extensions })); silent = false; } },
    selectionStart: { get: () => view.state.selection.main.from },
    selectionEnd: { get: () => view.state.selection.main.to },
    selectionDirection: { get: () => view.state.selection.main.anchor > view.state.selection.main.head ? 'backward' : 'forward' },
    scrollTop: { get: () => view.scrollDOM.scrollTop, set: value => { view.scrollDOM.scrollTop = value; } },
    scrollLeft: { get: () => view.scrollDOM.scrollLeft, set: value => { view.scrollDOM.scrollLeft = value; } },
  });
  editor.setSelectionRange = (from, to, direction) => {
    const clamp = n => Math.max(0, Math.min(view.state.doc.length, n));
    view.dispatch({ selection: EditorSelection.single(clamp(direction === 'backward' ? to : from), clamp(direction === 'backward' ? from : to)) });
  };
  editor.replaceText = (text, from = editor.selectionStart, to = editor.selectionEnd) => { view.focus(); view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true, userEvent: 'input' }); };
  editor.undo = () => undo(view); editor.redo = () => redo(view);
  editor.reveal = () => view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'nearest' }) });
  editor.halfPage = direction => {
    const head = view.state.selection.main.head, at = view.coordsAtPos(head);
    if (!at) return;
    const distance = view.scrollDOM.clientHeight / 2, target = at.top + direction * distance;
    const position = view.posAtCoords({ x: at.left + 1, y: target }, false);
    const offset = position ?? (direction < 0 ? 0 : view.state.doc.length);
    view.dispatch({ selection: { anchor: offset }, effects: EditorView.scrollIntoView(offset, { y: 'center' }) });
  };
  editor.caretRect = () => view.coordsAtPos(view.state.selection.main.head);
  editor.refresh = () => view.requestMeasure();
  editor.viewport = view.scrollDOM;
  editor.dispose = () => view.destroy();
  return editor;
}
