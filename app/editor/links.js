import { StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

export function linkAt(state, pos = state.selection.main.head) {
  const line = state.doc.lineAt(pos);
  for (const match of line.text.matchAll(/\[\[([^\]\n]+)\](?:\[([^\]\n]*)\])?\]/g)) {
    const from = line.from + match.index, to = from + match[0].length;
    if (from <= pos && pos <= to) return { from, to, target: match[1] };
  }
  return null;
}

// Reuse source highlighting so examples in code blocks and drawers stay literal.
// Only syntax is hidden: labels remain ordinary selectable document text.
export function collapsedLinks(styles) {
  const build = state => {
    const ranges = [];
    state.field(styles).between(0, state.doc.length, (from, to, decoration) => {
      if (decoration.spec.class !== 'org-link' || state.selection.ranges.some(range => range.from <= to && range.to >= from)) return;
      const text = state.sliceDoc(from, to), separator = text.indexOf('][');
      const labelFrom = separator < 0 ? from + 2 : from + separator + 2;
      const labelTo = to - 2;
      // Empty descriptions still need a visible editing target.
      if (labelFrom === labelTo) return;
      ranges.push(Decoration.replace({}).range(from, labelFrom), Decoration.replace({}).range(labelTo, to));
    });
    return Decoration.set(ranges, true);
  };
  return StateField.define({
    create: build,
    update: (value, tr) => tr.docChanged || tr.selection || tr.startState.field(styles) !== tr.state.field(styles) ? build(tr.state) : value,
    provide: field => EditorView.decorations.from(field),
  });
}
