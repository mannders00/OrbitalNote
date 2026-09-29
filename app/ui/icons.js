// Small, local outline icons. No runtime dependency or network assets.
const paths = {
  book: '<path d="M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1z"/>',
  pencil: '<path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15zM3 15l5 5"/>',
  'panel-left': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  'panel-right': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  files: '<rect x="7" y="7" width="13" height="14" rx="2"/><path d="M16 7V3H3v14h4"/>',
  file: '<path d="M14 3H5v18h14V8zM14 3v5h5"/>',
  'file-plus': '<path d="M14 3H5v18h14V8zM14 3v5h5M9 14h6M12 11v6"/>',
  folder: '<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  'folder-plus': '<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 13h6M12 10v6"/>',
  agenda: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7 8 1 1 2-2M13 8h4m-10 7 1 1 2-2M13 15h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h2M13 15h2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  tags: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/>',
  command: '<path d="M9 7a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v10a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
  settings: '<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  outline: '<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
  links: '<path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" transform="translate(0 -1)"/>',
  sliders: '<path d="M4 7h7M15 7h5M4 17h3M11 17h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  kebab: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  chevrons: '<path d="m9 8 3-3 3 3m-6 8 3 3 3-3"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flag: '<path d="M5 21V3m0 1h14l-3 4 3 4H5"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="3"/>',
  circle: '<circle cx="12" cy="12" r="6"/>',
};

export function icon(name) {
  return `<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.file}</svg>`;
}

export function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
}
