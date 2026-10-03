import mermaid from 'mermaid';
import katex from 'katex';
import renderMathInElement from 'katex/contrib/auto-render';

let serial = 0;
const originals = new WeakMap();
// Mermaid shares configuration and its renderer; serialize previews across splits.
let queue = Promise.resolve();
export function renderRichPreview(root) {
  const render = async () => {
    if (!root.isConnected) return;
    renderMathInElement(root, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }, { left: '$', right: '$', display: false }],
      throwOnError: false, trust: false, strict: 'warn',
      ignoredClasses: ['katex', 'rich-rendered', 'rich-error'],
    });
    for (const block of root.querySelectorAll('.src-latex, .src-mermaid')) {
      if (!block.isConnected || block.dataset.richTheme === document.documentElement.dataset.theme) continue;
      if (!originals.has(block)) originals.set(block, block.innerHTML);
      else block.innerHTML = originals.get(block);
      block.dataset.richRendered = 'true';
      block.dataset.richTheme = document.documentElement.dataset.theme;
      const code = block.textContent, result = document.createElement('div'); result.className = 'rich-rendered';
      try {
        if (block.classList.contains('src-latex')) {
          katex.render(code, result, { displayMode: true, throwOnError: true, trust: false });
        } else {
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default' });
          const { svg } = await mermaid.render('org-diagram-' + ++serial, code);
          result.innerHTML = svg;
          result.setAttribute('role', 'img'); result.setAttribute('aria-label', 'Mermaid diagram');
        }
        if (!block.isConnected) continue;
        block.replaceChildren(result);
      } catch {
        const error = document.createElement('p'); error.className = 'rich-error'; error.textContent = 'Could not render this block. Edit the source to correct its syntax.';
        if (block.isConnected) block.prepend(error);
      }
    }
  };
  queue = queue.then(render, render); return queue;
}
