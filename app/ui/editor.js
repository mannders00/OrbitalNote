export const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Textareas normalize line endings. Keep a raw buffer in parallel and splice
// only the changed range, preserving even mixed CRLF/LF outside that edit.
export function updateRaw(raw, before, after, eol) {
  let start = 0, oldEnd = before.length, newEnd = after.length;
  while (start < oldEnd && start < newEnd && before[start] === after[start]) start++;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  const rawOffset = index => { let p = 0; for (let i = 0; i < index; i++) p += raw[p] === '\r' && raw[p + 1] === '\n' ? 2 : 1; return p; };
  return raw.slice(0, rawOffset(start)) + after.slice(start, newEnd).replaceAll('\n', eol) + raw.slice(rawOffset(oldEnd));
}

// Cosmetic highlighting only: this never rewrites the buffer or parses agenda dates.
export function highlight(source) {
  let block = false;
  return source.split('\n').map(line => {
    if (/^\s*#\+begin_/i.test(line)) block = true;
    const code = block;
    if (/^\s*#\+end_/i.test(line)) block = false;
    if (code) return `<span class="syn-code">${escapeHTML(line)}</span>`;
    if (/^\s*(#|:[A-Z_]+:)/.test(line)) return `<span class="syn-meta">${escapeHTML(line)}</span>`;
    const re = /\[\[[^\]]+\](?:\[[^\]]*\])?\]|[<\[]\d{4}-\d{2}-\d{2}[^>\]\n]*[>\]]|\b(?:TODO|DONE|NEXT|WAITING|CANCELLED)\b|\s:[\w@:]+:\s*$|[~=][^~=]+[~=]/g;
    let out = '', last = 0;
    for (const match of line.matchAll(re)) {
      out += escapeHTML(line.slice(last, match.index));
      const v = match[0];
      const cls = v.startsWith('[[') ? 'link' : /^[<\[]\d/.test(v) ? 'time' : /^[~=]/.test(v) ? 'code' : v.includes(':') ? 'meta' : 'todo';
      out += `<span class="syn-${cls}">${escapeHTML(v)}</span>`; last = match.index + v.length;
    }
    out += escapeHTML(line.slice(last));
    return /^\*+\s/.test(line) ? `<span class="syn-heading${/^\*+\s+TODO(?:\s|$)/.test(line) ? ' syn-heading-todo' : ''}">${out}</span>` : out;
  }).join('\n') + '\n';
}

// Use native editing so commands participate in the WebView's undo stack.
export function replaceSelection(editor, text, start = editor.selectionStart, end = editor.selectionEnd) {
  if (editor.replaceText) { editor.replaceText(text, start, end); return; }
  editor.focus(); editor.setSelectionRange(start, end);
  if (!document.execCommand('insertText', false, text)) {
    editor.setRangeText(text, start, end, 'end');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
export function lineRange(editor) {
  const start = editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
  let end = editor.value.indexOf('\n', editor.selectionEnd);
  if (end < 0) end = editor.value.length;
  return { start, end, text: editor.value.slice(start, end) };
}
export function command(editor, name, extra = '') {
  const { start, end, text } = lineRange(editor);
  if (name === 'heading') return replaceSelection(editor, '\n* ', end, end);
  if (name === 'promote' || name === 'demote') {
    if (!/^\*+ /.test(text)) return;
    return replaceSelection(editor, name === 'demote' ? '*' + text : text.replace(/^\*\*/, '*'), start, end);
  }
  if (name === 'todo') {
    if (!/^\*+ /.test(text)) return;
    return replaceSelection(editor, text.replace(/^(\*+ )(TODO |DONE )?/, (_, stars, state) => stars + (state === 'TODO ' ? 'DONE ' : state === 'DONE ' ? '' : 'TODO ')), start, end);
  }
  if (name === 'checkbox') return replaceSelection(editor, /\[[ X-]\]/.test(text) ? text.replace(/\[([ X-])\]/, (_, v) => v === 'X' ? '[ ]' : '[X]') : '- [ ] ' + text, start, end);
  if (name === 'indent' || name === 'outdent') return replaceSelection(editor, text.split('\n').map(l => name === 'indent' ? '  ' + l : l.replace(/^(  |\t)/, '')).join('\n'), start, end);
  if (name === 'timestamp') return replaceSelection(editor, `<${extra}>`);
  if (name === 'link') return replaceSelection(editor, `[[${extra}][${editor.value.slice(editor.selectionStart, editor.selectionEnd) || 'link'}]]`);
}
