// Share source coordinates between the two presentations. Heading folds live in
// CodeMirror (and therefore map through edits); preview IDs are not identities.
const headings = 'h1,h2,h3,h4,h5,h6';
const plain = text => text.replace(/\[\[([^\]]+)\]\[([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
  .replace(/^\s*(?:\*+\s+|[-+]\s+(?:\[[ Xx-]\]\s*)?|\d+[.)]\s+)/, '')
  .replace(/[*\/_~=+|]/g, '').replace(/\s+/g, ' ').trim();

export function createDocumentView(surface, editor) {
  const preview = surface.querySelector('[data-ui="preview"]');
  let source = '', anchors = [], pending = null, restored = null, sourceReturn = null, mode = 'edit';
  const cancel = () => { pending = null; };
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) preview.addEventListener(event, cancel, { passive: true });
  const observer = new ResizeObserver(() => {
    if (preview.clientHeight) preview.style.setProperty('--document-tail', `${preview.clientHeight / 2}px`);
    if (mode === 'preview' && pending) placePreview(pending);
  });
  observer.observe(preview);
  const visible = el => el.getClientRects().length && !el.closest('[hidden], details:not([open])');
  const foldSignature = () => editor.getHeadingFolds().join(',') + '/' + editor.getMetadataFolds().join(',');
  function syncFolds() {
    const folds = new Set(editor.getHeadingFolds());
    for (const heading of preview.querySelectorAll('[data-source-heading]')) heading.querySelector('.preview-heading-fold')?.updateFold(folds.has(Number(heading.dataset.sourceHeading)), false);
    const metadata = editor.metadataRanges();
    for (const details of preview.querySelectorAll('details')) {
      const summary = details.querySelector(':scope > summary');
      if (summary?.textContent !== 'Properties') continue;
      const heading = details.closest('[class^="outline-text-"]')?.previousElementSibling;
      const owner = heading?.dataset.sourceHeading === undefined ? -1 : Number(heading.dataset.sourceHeading);
      const ranges = metadata.filter(range => range.headingStart === owner && ['PROPERTIES', 'LOGBOOK', 'HISTORY'].includes(range.kind));
      if (!ranges.length) continue;
      details.open = ranges.some(range => !range.folded);
      summary.onclick = event => {
        event.preventDefault();
        pending = null; restored = null; sourceReturn = null;
        const open = !details.open, collapsed = new Set(editor.getMetadataFolds());
        for (const range of ranges) { if (open) collapsed.delete(range.start); else collapsed.add(range.start); }
        editor.setMetadataFolds([...collapsed]); details.open = open;
      };
    }
  }
  function prepare(text, outline) {
    source = text; anchors = [];
    const lines = source.split('\n'), offsets = [];
    let offset = 0;
    for (const line of lines) { offsets.push(offset); offset += line.length + 1; }
    const renderedHeadings = [...preview.querySelectorAll(headings)];
    for (let i = 0; i < renderedHeadings.length; i++) {
      const line = outline[i]?.line;
      if (line) renderedHeadings[i].dataset.sourceHeading = String(offsets[line - 1]);
    }
    // Match rendered blocks to source lines, within each heading. This keeps
    // paragraphs, lists, tables, and source blocks anchored even in long notes.
    let cursor = 0;
    const candidates = preview.querySelectorAll(`${headings},p,li,pre,table,figure,details,.src`);
    for (const el of candidates) {
      if (el.parentElement.closest('li,pre,table,figure,details,.src,blockquote p')) continue;
      let line;
      if (el.dataset.sourceHeading !== undefined) {
        line = outline[renderedHeadings.indexOf(el)]?.line - 1;
      } else {
        const nextHeading = renderedHeadings.find(h => Number(h.dataset.sourceHeading) > (offsets[cursor] ?? source.length));
        const stop = nextHeading ? offsets.indexOf(Number(nextHeading.dataset.sourceHeading)) : lines.length;
        const content = plain(el.textContent);
        for (let i = cursor; i < stop; i++) {
          if (el.matches('.src') && /^\s*#\+begin_src\b/i.test(lines[i]) || el.matches('details') && /^\s*:(?:PROPERTIES|LOGBOOK):/i.test(lines[i])) { line = i; break; }
          const text = plain(lines[i]);
          if (text && !/^\s*(#\+|:[\w]+:)/.test(lines[i]) && (content.startsWith(text) || text.startsWith(content) && content)) { line = i; break; }
        }
      }
      if (line == null || line < 0 || offsets[line] == null) continue;
      let end = line;
      if (el.matches('.src')) { while (end + 1 < lines.length && !/^\s*#\+end_src\b/i.test(lines[end])) end++; }
      else if (el.matches('p,pre,table')) { while (end + 1 < lines.length && lines[end + 1].trim() && !/^\s*(?:\*+ |#\+|:[\w]+:)/.test(lines[end + 1])) end++; }
      anchors.push({ el, from: offsets[line], to: offsets[end] + lines[end].length });
      cursor = end + 1;
    }
    syncFolds();
    observer.disconnect(); observer.observe(preview);
    for (const child of preview.children) observer.observe(child);
    if (pending && mode === 'preview') placePreview(pending);
  }
  function placePreview(anchor) {
    if (anchor.previewScroll != null && anchor.previewSource === source) {
      preview.scrollTop = anchor.previewScroll;
      restored = { anchor, scroll: preview.scrollTop, source };
      return;
    }
    const available = anchors.filter(a => visible(a.el));
    const block = available.find(a => a.from <= anchor.pos && a.to >= anchor.pos) || [...available].reverse().find(a => a.from <= anchor.pos) || available[0];
    if (!block) return;
    const rect = block.el.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (anchor.pos - block.from) / Math.max(1, block.to - block.from)));
    preview.scrollTop += rect.top + fraction * rect.height - preview.getBoundingClientRect().top - anchor.offset;
    restored = { anchor, scroll: preview.scrollTop, source };
  }
  return {
    prepare, syncFolds,
    capture(currentMode) {
      if (currentMode === 'edit') {
        if (sourceReturn && sourceReturn.source === editor.value && sourceReturn.folds === foldSignature() && Math.abs(sourceReturn.scroll - editor.scrollTop) < 1) return sourceReturn.anchor;
        return editor.captureViewport();
      }
      if (restored && restored.source === source && Math.abs(restored.scroll - preview.scrollTop) < 1) return restored.anchor;
      const y = preview.getBoundingClientRect().top + Math.min(24, preview.clientHeight / 4);
      const available = anchors.filter(a => visible(a.el));
      const block = available.find(a => a.el.getBoundingClientRect().bottom >= y) || available.at(-1);
      if (!block) return { pos: 0, offset: 0 };
      const rect = block.el.getBoundingClientRect(), fraction = Math.max(0, Math.min(1, (y - rect.top) / Math.max(1, rect.height)));
      return { pos: Math.round(block.from + fraction * (block.to - block.from)), offset: rect.top + fraction * rect.height - preview.getBoundingClientRect().top, relocate: true, previewScroll: preview.scrollTop, previewSource: source };
    },
    restore(nextMode, anchor) {
      mode = nextMode; pending = mode === 'preview' ? anchor : null;
      syncFolds();
      if (mode === 'preview') { placePreview(anchor); requestAnimationFrame(() => { if (pending === anchor) placePreview(anchor); }); }
      else { editor.refresh(); editor.restoreViewport(anchor, () => {
        if (mode === 'edit') sourceReturn = { anchor, scroll: editor.scrollTop, source: editor.value, folds: foldSignature() };
      }); }
    },
    fold(start, collapsed) {
      pending = null; restored = null; sourceReturn = null;
      const folds = new Set(editor.getHeadingFolds());
      if (collapsed) folds.add(start); else folds.delete(start);
      editor.setHeadingFolds([...folds]);
    },
    dispose() { observer.disconnect(); },
  };
}
