// OrbitalNote Theme v1. Built-ins and custom CSS share the public color tokens.
import { themeCSS, themeTreatments } from './theme-presets.js';
export const themes = [
  ['dark', 'Graphite', 'dark', '#1e1e1e', '#262626', '#dadada', '#75adf5'],
  ['coffee', 'Terminal', 'dark', '#181818', '#282828', '#d8d8d8', '#7cafc2'],
  ['sand', 'Editorial', 'light', '#fbf8f2', '#f0ece2', '#342f29', '#8b493b'],
  ['plum', 'Studio', 'dark', '#201d29', '#292434', '#eee9f7', '#c3a0ee'],
  ['midnight', 'Focus', 'dark', '#1c2420', '#232e27', '#e1e9e1', '#a5ceb5'],
  ['ocean', 'Blueprint', 'light', '#f7f9fb', '#e9eff4', '#182b3a', '#1f568e'],
].map(theme => [theme[0], themeTreatments[theme[0]][0], ...theme.slice(2)]);

// Every family retains its typography and layout in either appearance.
const companionPalettes = {
  dark: ['#f8f8f8', '#eeeeee', '#303030', '#2864b4'],
  coffee: ['#f8f8f8', '#e8e8e8', '#383838', '#416f80'],
  sand: ['#24221f', '#2d2a25', '#ece3d5', '#d6aa87'],
  plum: ['#f6f5fa', '#eeeaf5', '#342d46', '#7041b6'],
  midnight: ['#fafbf8', '#f2f4ee', '#24352e', '#356b55'],
  ocean: ['#131e29', '#1b2a37', '#e3edf6', '#86bce5'],
};
// Stable IDs keep existing choices and shared workspace settings compatible.
// Retired families migrate by reading/working style, retaining their appearance.
export const retiredThemes = {
  light: ['sand', 'light'], forest: ['sand', 'dark'], nord: ['dark', 'dark'],
  rose: ['midnight', 'light'], aurora: ['dark', 'dark'], ember: ['sand', 'dark'], iris: ['plum', 'dark'],
};
export function resolveTheme(id) {
  return themes.some(t => t[0] === id) ? id : Object.hasOwn(retiredThemes, id) ? retiredThemes[id][0] : 'dark';
}
export function themeVariant(theme, mode) {
  return mode === theme[2] ? theme : [...theme.slice(0, 2), mode, ...companionPalettes[theme[0]]];
}
export function setupAppearance(select, nativeTheme) {
  const description = document.getElementById('theme-description');
  const builtIn = document.createElement('style'), custom = document.createElement('style');
  document.head.append(builtIn, custom);
  const system = matchMedia('(prefers-color-scheme: dark)');
  const appearance = document.getElementById('theme-mode');
  const saved = localStorage.getItem('org-theme');
  select.replaceChildren(...themes.map(([id, name]) => new Option(name, id)));
  select.value = resolveTheme(saved);
  // Retain existing fixed appearances; new installs and legacy System follow OS.
  const originalMode = Object.hasOwn(retiredThemes, saved) ? retiredThemes[saved][1] : themes.find(t => t[0] === select.value)[2];
  appearance.value = localStorage.getItem('org-theme-mode') || (saved && saved !== 'system' ? originalMode : 'system');
  if (!appearance.value) appearance.value = 'system';
  if (Object.hasOwn(retiredThemes, saved)) { localStorage.setItem('org-theme', select.value); localStorage.setItem('org-theme-mode', appearance.value); }
  function apply() {
    const id = select.value;
    const customBase = /Base appearance:\s*(light|dark)/i.exec(custom.textContent)?.[1].toLowerCase();
    const mode = customBase || (appearance.value === 'system' ? system.matches ? 'dark' : 'light' : appearance.value);
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.themeFamily = id;
    description.textContent = customBase ? 'Standalone custom CSS is active. Clear it below to use the selected preset.' : themeTreatments[id][1];
    builtIn.textContent = customBase ? '' : themeCSS(themeVariant(themes.find(t => t[0] === id), mode));
    nativeTheme(mode === 'dark');
    document.dispatchEvent(new Event('appearance-change'));
  }
  const save = () => { localStorage.setItem('org-theme', select.value); localStorage.setItem('org-theme-mode', appearance.value); apply(); };
  select.addEventListener('change', save);
  appearance.addEventListener('change', save);
  system.addEventListener('change', apply); apply();
  const input = document.getElementById('theme-css');
  input.placeholder = '/* OrbitalNote Theme v1: My theme */\n:root {\n  --bg: #18231d;\n  --text: #dce9df;\n  --accent: #91c9a0;\n}';
  input.value = localStorage.getItem('orbitalnote-theme-css') || ''; custom.textContent = input.value;
  apply();
  document.getElementById('theme-apply').onclick = () => {
    custom.textContent = input.value; localStorage.setItem('orbitalnote-theme-css', input.value);
    document.getElementById('theme-status').textContent = 'Custom CSS applied and saved.';
    apply();
  };
  document.getElementById('theme-clear').onclick = () => {
    input.value = ''; custom.textContent = ''; localStorage.removeItem('orbitalnote-theme-css');
    document.getElementById('theme-status').textContent = 'Custom CSS cleared.';
    apply();
  };
}

export function resizeSidebar(sidebar, side) {
  const key = `orbitalnote-${side}-width`, variable = `--${side}-width`;
  const saved = Number(localStorage.getItem(key));
  if (saved >= 180 && saved <= 600) document.documentElement.style.setProperty(variable, saved + 'px');
  const handle = document.createElement('div'); handle.className = 'sidebar-resizer'; handle.dataset.side = side;
  handle.tabIndex = 0; handle.setAttribute('role', 'separator'); handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', `Resize ${side} sidebar`);
  handle.setAttribute('aria-valuemin', '180'); handle.setAttribute('aria-valuemax', '600');
  const set = value => {
    const width = Math.round(Math.max(180, Math.min(600, innerWidth * .45, value)));
    document.documentElement.style.setProperty(variable, width + 'px'); localStorage.setItem(key, width);
    handle.setAttribute('aria-valuenow', width);
  };
  handle.setAttribute('aria-valuenow', saved || (side === 'left' ? 232 : 228));
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); handle.setPointerCapture(e.pointerId);
    const start = e.clientX, width = sidebar.getBoundingClientRect().width;
    handle.onpointermove = event => set(width + (event.clientX - start) * (side === 'left' ? 1 : -1));
    handle.onlostpointercapture = () => { handle.onpointermove = null; };
    handle.onpointerup = event => handle.releasePointerCapture(event.pointerId);
  });
  handle.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); set(e.key === 'Home' ? 180 : e.key === 'End' ? 600 : sidebar.getBoundingClientRect().width + (e.key === 'ArrowRight' ? 16 : -16) * (side === 'left' ? 1 : -1));
  });
  sidebar.append(handle);
}
