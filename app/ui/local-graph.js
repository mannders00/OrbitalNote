const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const title = path => path.split('/').pop().replace(/\.org$/i, '');

export function localNeighbors(path, links, backlinks, files) {
  const existing = new Set(files.map(file => file.path)), nodes = new Map();
  const add = (target, direction) => {
    if (target === path || !existing.has(target)) return;
    const node = nodes.get(target) || { path: target, incoming: false, outgoing: false };
    node[direction] = true; nodes.set(target, node);
  };
  for (const link of links || []) {
    let target = link.target.replace(/^file:/, '').split('::')[0];
    if (/^[a-z][a-z\d+.-]*:|^[#/~]/i.test(target)) continue;
    const parts = path.split('/').slice(0, -1);
    for (const part of target.split('/')) {
      if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part);
    }
    add(parts.join('/'), 'outgoing');
  }
  for (const link of backlinks || []) add(link.path, 'incoming');
  return [...nodes.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function localGraphHTML(path, nodes) {
  if (!nodes.length) return '<p class="local-graph-empty">No linked notes yet. Add an Org link such as [[file:Other note.org]].</p>';
  const visible = nodes.slice(0, 8), positioned = visible.map((node, i) => {
    const angle = -Math.PI / 2 + i * 2 * Math.PI / visible.length;
    return { ...node, x: 50 + 36 * Math.cos(angle), y: 50 + 36 * Math.sin(angle) };
  });
  const kind = node => node.incoming && node.outgoing ? 'both' : node.incoming ? 'incoming' : 'outgoing';
  const label = node => node.incoming && node.outgoing ? 'Linked both ways' : node.incoming ? 'Links here' : 'Linked from this note';
  return `<div class="local-graph-map" aria-label="Local note graph"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${positioned.map(node => `<line class="graph-${kind(node)}" x1="50" y1="50" x2="${node.x}" y2="${node.y}"/>`).join('')}</svg><span class="local-graph-center" title="${esc(path)}"><i></i>${esc(title(path))}</span>${positioned.map(node => `<button type="button" class="local-graph-node graph-${kind(node)}" data-open="${esc(node.path)}" style="left:${node.x}%;top:${node.y}%" title="${esc(node.path)} — ${label(node)}" aria-label="Open ${esc(node.path)}: ${label(node)}"><i></i><span>${esc(title(node.path))}</span></button>`).join('')}</div>
  <p class="local-graph-caption">${nodes.length} linked note${nodes.length === 1 ? '' : 's'}${nodes.length > visible.length ? ` · showing ${visible.length} in graph` : ''}</p>
  <div class="local-graph-links">${nodes.map(node => `<button type="button" data-open="${esc(node.path)}" title="${esc(node.path)}"><span>${esc(title(node.path))}</span><small>${label(node)}</small></button>`).join('')}</div>`;
}
