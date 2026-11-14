import { autocompletion, completionKeymap, moveCompletionSelection } from '@codemirror/autocomplete';
import { Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';

export function relativeNoteLink(origin, target) {
  const from = origin.split('/').slice(0, -1), to = target.split('/');
  while (from.length && to.length && from[0] === to[0]) { from.shift(); to.shift(); }
  return 'file:' + [...from.map(() => '..'), ...to.map(encodeURIComponent)].join('/');
}

export function noteLinkCompletion(getNotes) {
  const source = context => {
    const match = context.matchBefore(/\[\[(?:file:)?[^[\]\n]*/);
    if (!match || !context.state.selection.main.empty) return null;
    const query = match.text.slice(2).replace(/^file:/, '');
    if (/^(?:[a-z][a-z\d+.-]*:|[#*])/i.test(query)) return null;
    const { path = '', files = [] } = getNotes();
    const targetFrom = match.from + 2, from = context.pos - query.length;
    return {
      from,
      options: files.filter(file => file !== path).map(file => ({
        label: file,
        type: 'text',
        apply(view, _completion, _from, to) {
          const line = view.state.doc.lineAt(to), rest = view.state.sliceDoc(to, line.to);
          const closing = rest.indexOf(']');
          let end = closing < 0 ? to : to + closing;
          const hasLabel = closing >= 0 && rest.slice(closing).startsWith('][');
          if (closing >= 0 && !hasLabel) end += rest.slice(closing).startsWith(']]') ? 2 : 1;
          const target = relativeNoteLink(path, file);
          const insert = target + (hasLabel ? '' : '][]]');
          view.dispatch({ changes: { from: targetFrom, to: end, insert },
            selection: { anchor: targetFrom + target.length + 2 }, userEvent: 'input.complete', scrollIntoView: true });
        },
      })),
      validFor: /^[^[\]\n:]*$/,
    };
  };
  return [autocompletion({ override: [source], defaultKeymap: false, activateOnTyping: true, icons: false }),
    Prec.highest(keymap.of([
      { key: 'Ctrl-n', run: moveCompletionSelection(true) },
      { key: 'Ctrl-p', run: moveCompletionSelection(false) },
      ...completionKeymap,
    ]))];
}
