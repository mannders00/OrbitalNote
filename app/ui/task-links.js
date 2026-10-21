import { escapeHTML as esc } from './editor.js';

export function taskTitleHTML(title, path) {
  let html = '', end = 0;
  for (const match of title.matchAll(/\[\[([^\]\n]+)\](?:\[([^\]\n]*)\])?\]/g)) {
    html += esc(title.slice(end, match.index));
    const target = match[1], label = match[2] || target.replace(/^file:/, '').split('/').pop().replace(/\.org$/i, '');
    html += /^(https?:|mailto:|file:)/i.test(target) || !/^[a-z][a-z\d+.-]*:/i.test(target)
      ? `<a href="${esc(target)}" data-task-link="${esc(target)}" data-link-source="${esc(path)}">${esc(label)}</a>` : esc(label);
    end = match.index + match[0].length;
  }
  return html + esc(title.slice(end));
}
