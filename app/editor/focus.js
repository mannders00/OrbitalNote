import { StateEffect, StateField, EditorState, EditorSelection, Annotation } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

export const focusEffect = StateEffect.define();
export const externalEdit = Annotation.define();
export const focusRange = StateField.define({
  create: () => null,
  update(range, tr) {
    if (range && tr.docChanged) range = { from: tr.changes.mapPos(range.from, -1), to: tr.changes.mapPos(range.to, 1) };
    for (const effect of tr.effects) if (effect.is(focusEffect)) range = effect.value;
    return range;
  },
});
const hidden = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    if (!tr.docChanged && !tr.effects.some(e => e.is(focusEffect))) return value;
    const range = tr.state.field(focusRange), ranges = [];
    if (range?.from) ranges.push(Decoration.replace({ block: true }).range(0, range.from));
    if (range && range.to < tr.state.doc.length) ranges.push(Decoration.replace({ block: true }).range(range.to, tr.state.doc.length));
    return Decoration.set(ranges);
  },
  provide: field => EditorView.decorations.from(field),
});
export const headingFocus = [focusRange, hidden, EditorState.transactionFilter.of(tr => {
  const range = tr.startState.field(focusRange);
  if (!range || tr.annotation(externalEdit) || tr.effects.some(e => e.is(focusEffect))) return tr;
  if (tr.docChanged) {
    let outside = false;
    tr.changes.iterChangedRanges((from, to) => { if (from < range.from || to > range.to) outside = true; });
    if (outside) return [];
  }
  const next = tr.state.field(focusRange), selection = tr.newSelection;
  const clamp = n => Math.max(next.from, Math.min(next.to, n));
  const ranges = selection.ranges.map(r => EditorSelection.range(clamp(r.anchor), clamp(r.head)));
  const limited = EditorSelection.create(ranges, selection.mainIndex);
  return limited.eq(selection) ? tr : [tr, { selection: limited, sequential: true }];
})];
