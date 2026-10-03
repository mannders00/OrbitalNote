import { StateEffect, StateField } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { foldedRanges, unfoldEffect } from '@codemirror/language';
import { search, SearchQuery, setSearchQuery, getSearchQuery, openSearchPanel, closeSearchPanel, findNext, findPrevious, replaceNext, replaceAll } from '@codemirror/search';

// A captured selection is independent of the selection used to navigate matches.
// Map it through edits so replacements never spill out into the rest of a note.
export const setSearchScope = StateEffect.define();
export const searchScope = StateField.define({
  create: () => null,
  update(scope, tr) {
    if (scope && tr.docChanged) scope = { from: tr.changes.mapPos(scope.from, -1), to: tr.changes.mapPos(scope.to, 1) };
    for (const effect of tr.effects) if (effect.is(setSearchScope)) scope = effect.value;
    return scope;
  },
});
export const inSearchScope = (_match, state, from, to) => {
  const scope = state.field(searchScope);
  return !scope || from >= scope.from && to <= scope.to;
};

function createPanel(view) {
  const dom = document.createElement('div'); dom.className = 'note-search';
  dom.setAttribute('role', 'search'); dom.setAttribute('aria-label', 'Find and replace in note');
  dom.innerHTML = `<div class="note-search-row">
    <input name="find" main-field="true" aria-label="Find in note" placeholder="Find in note" autocomplete="off" spellcheck="false">
    <button type="button" name="previous" aria-label="Previous match" title="Previous match (Shift+Enter)">↑</button>
    <button type="button" name="next" aria-label="Next match" title="Next match (Enter)">↓</button>
    <output aria-live="polite" class="note-search-count"></output>
    <button type="button" name="close" aria-label="Close search" title="Close search (Escape)">×</button>
  </div><div class="note-search-options">
    <label><input type="checkbox" name="case">Match case</label>
    <label><input type="checkbox" name="word">Whole word</label>
    <label><input type="checkbox" name="regex">Regex</label>
    <label><input type="checkbox" name="selection">In selection</label>
  </div><div class="note-search-row">
    <input name="replace" aria-label="Replace with" placeholder="Replace with" autocomplete="off" spellcheck="false">
    <button type="button" name="replace-one">Replace</button>
    <button type="button" name="replace-all">Replace all</button>
  </div><small class="note-search-help">Enter / Shift+Enter: next / previous · Escape: return to editor</small>`;
  const field = name => dom.querySelector(`[name="${name}"]`);
  const output = dom.querySelector('output'), help = dom.querySelector('small');
  let initialSelection = view.state.selection.main;
  let scopeOn = !!view.state.field(searchScope);
  const initial = getSearchQuery(view.state);
  field('find').value = initial.search; field('replace').value = initial.replace;
  field('case').checked = initial.caseSensitive; field('word').checked = initial.wholeWord;
  field('regex').checked = initial.regexp; field('selection').checked = scopeOn;
  const query = () => new SearchQuery({ search: field('find').value, replace: field('replace').value,
    caseSensitive: field('case').checked, wholeWord: field('word').checked,
    regexp: field('regex').checked, literal: !field('regex').checked,
    // A fresh filter also invalidates viewport highlights when scope changes.
    test: (match, state, from, to) => inSearchScope(match, state, from, to) });
  function commit() { view.dispatch({ effects: setSearchQuery.of(query()) }); }
  function refresh() {
    const q = getSearchQuery(view.state);
    const invalid = !!q.search && !q.valid;
    field('find').setAttribute('aria-invalid', String(invalid));
    let count = 0, current = 0;
    if (q.valid) {
      const cursor = q.getCursor(view.state), selected = view.state.selection.main;
      for (let result = cursor.next(); !result.done; result = cursor.next()) {
        count++;
        if (result.value.from === selected.from && result.value.to === selected.to) current = count;
        if (count >= 10000) break;
      }
    }
    output.textContent = invalid ? 'Invalid regex' : !q.search ? '' : `${current ? current + ' / ' : ''}${count}${count === 10000 ? '+' : ''} matches`;
    for (const name of ['previous', 'next', 'replace-one', 'replace-all']) field(name).disabled = !q.valid || !count;
    field('selection').disabled = !scopeOn && initialSelection.empty;
    help.textContent = field('regex').checked ? 'JavaScript regex · Replace: $1, $2, $& · \\n for newline · Escape: close' : 'Enter / Shift+Enter: next / previous · Escape: return to editor';
  }
  function revealMatch() {
    const { from, to } = view.state.selection.main, effects = [];
    foldedRanges(view.state).between(0, view.state.doc.length, (start, end) => {
      if (start < to && end >= from) effects.push(unfoldEffect.of({ from: start, to: end }));
    });
    if (effects.length) view.dispatch({ effects: [...effects, EditorView.scrollIntoView(view.state.selection.main, { y: 'nearest' })] });
  }
  function navigate(backward) { commit(); (backward ? findPrevious : findNext)(view); revealMatch(); }
  function replaceOne() { commit(); replaceNext(view); revealMatch(); }
  function close() { view.dispatch({ effects: setSearchScope.of(null) }); closeSearchPanel(view); view.focus(); }
  for (const name of ['find', 'replace']) field(name).addEventListener('input', commit);
  for (const name of ['case', 'word', 'regex']) field(name).addEventListener('change', commit);
  field('selection').addEventListener('change', () => {
    scopeOn = field('selection').checked;
    view.dispatch({ effects: [setSearchScope.of(scopeOn ? { from: initialSelection.from, to: initialSelection.to } : null), setSearchQuery.of(query())] });
  });
  field('previous').onclick = () => navigate(true); field('next').onclick = () => navigate(false);
  field('replace-one').onclick = replaceOne;
  field('replace-all').onclick = () => { commit(); replaceAll(view); };
  field('close').onclick = close;
  dom.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
      event.preventDefault(); event.stopPropagation();
      if (event.target === field('replace')) replaceOne(); else navigate(event.shiftKey);
    }
  });
  return { dom, top: false, mount: refresh, update(update) {
    if (update.docChanged) {
      initialSelection = initialSelection.map(update.changes);
    }
    if (update.selectionSet && view.hasFocus && !scopeOn) initialSelection = view.state.selection.main;
    // Vim refreshes its last / query asynchronously when the cursor moves.
    // While this bar is open its explicit fields own the visible search query.
    if (update.transactions.some(tr => tr.effects.some(e => e.is(setSearchQuery) && e.value.forVim !== undefined))) {
      queueMicrotask(() => { if (dom.isConnected) commit(); });
    }
    if (update.docChanged || update.selectionSet || update.transactions.some(tr => tr.effects.some(e => e.is(setSearchQuery)))) refresh();
  } };
}

export const noteSearch = [searchScope, search({ top: false, createPanel, scrollToMatch: range => EditorView.scrollIntoView(range, { y: 'nearest' }) })];
export function openNoteSearch(view, replace = false) {
  openSearchPanel(view);
  if (replace) view.dom.querySelector('.note-search [name="replace"]')?.focus();
}
