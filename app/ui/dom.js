// Patch rendered children without blanking a panel or discarding stable nodes.
// Only use for delegated-event UI, not editor-owned or directly wired widgets.
export function patchHTML(root, html) {
  if (root.renderedHTML === html) return;
  const template = document.createElement('template'); template.innerHTML = html;
  const scroll = [];
  for (let el = root; el; el = el.parentElement) if (el.scrollTop || el.scrollLeft) scroll.push([el, el.scrollTop, el.scrollLeft]);
  const key = node => node.nodeType === 1 ? node.getAttribute('data-key') || node.getAttribute('data-tab-id') || node.id || '' : '';
  const same = (a,b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && key(a) === key(b);
  const children = (parent, next) => {
    let cursor = parent.firstChild;
    const keyed = new Map([...parent.childNodes].filter(n=>key(n)).map(n=>[key(n),n]));
    for (const desired of [...next.childNodes]) {
      let node = key(desired) ? keyed.get(key(desired)) : cursor;
      if (!node || !same(node, desired)) node = desired.cloneNode(true);
      if (node !== cursor) parent.insertBefore(node, cursor);
      if (node.nodeType === 3) { if (node.nodeValue !== desired.nodeValue) node.nodeValue = desired.nodeValue; }
      else if (node.nodeType === 1) {
        for (const attr of [...node.attributes]) if (!desired.hasAttribute(attr.name) && !(node.tagName === 'DETAILS' && attr.name === 'open')) node.removeAttribute(attr.name);
        for (const attr of desired.attributes) if (!(node.tagName === 'DETAILS' && attr.name === 'open') && node.getAttribute(attr.name) !== attr.value) node.setAttribute(attr.name, attr.value);
        children(node, desired);
      }
      cursor = node.nextSibling;
    }
    while (cursor) { const next = cursor.nextSibling; cursor.remove(); cursor = next; }
  };
  children(root, template.content); root.renderedHTML = html;
  for (const [el, top, left] of scroll) { el.scrollTop = top; el.scrollLeft = left; }
}
