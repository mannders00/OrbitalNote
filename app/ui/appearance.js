// OrbitalNote Theme v1. Built-ins and custom CSS share the public color tokens.
import { themeCSS, themeTreatments } from './theme-presets.js';
export const themes = [
  ['dark', 'Graphite', 'dark', '#1e1e1e', '#262626', '#dadada', '#75adf5'],
  ['light', 'Paper', 'light', '#ffffff', '#f6f6f6', '#303030', '#286fc7'],
  ['midnight', 'Midnight', 'dark', '#101827', '#182338', '#dce7f7', '#8bb9ff'],
  ['nord', 'Nord', 'dark', '#2e3440', '#3b4252', '#eceff4', '#88c0d0'],
  ['forest', 'Forest', 'dark', '#18231d', '#223229', '#dce9df', '#91c9a0'],
  ['plum', 'Plum', 'dark', '#261e2d', '#34283e', '#eddfef', '#cc9de7'],
  ['coffee', 'Terminal', 'dark', '#121916', '#18211c', '#d9e6d9', '#9acb8b'],
  ['sand', 'Sand', 'light', '#faf5e9', '#eee6d5', '#443c30', '#98652a'],
  ['rose', 'Rose', 'light', '#fff6f8', '#f2e5e9', '#49323c', '#ad4671'],
  ['ocean', 'Ocean', 'light', '#f2fafc', '#e2eff3', '#203f4b', '#147e98'],
  ['aurora', 'Aurora', 'dark', '#151a2b', '#1d253a', '#e2e9f5', '#80deca'],
  ['ember', 'Ember', 'dark', '#221c1a', '#2e2521', '#eee2d8', '#efad78'],
  ['iris', 'Iris', 'dark', '#201d30', '#2a263e', '#e9e4f5', '#bca7f5'],
].map(theme => [theme[0], themeTreatments[theme[0]][0], ...theme.slice(2)]);

// Every family retains its typography and layout in either appearance.
const companionPalettes = {
  dark: ['#f7f8fa', '#eceef2', '#292e38', '#2864b4'],
  light: ['#202225', '#292c30', '#e2e4e7', '#8eb8ed'],
  midnight: ['#f3f6fc', '#e7edf7', '#26364f', '#3563ac'],
  nord: ['#eceff4', '#e0e5ed', '#2e3440', '#356f83'],
  forest: ['#f4f7ef', '#e6eddf', '#2c3e30', '#397248'],
  plum: ['#faf5fc', '#eee5f3', '#45334f', '#8750a4'],
  coffee: ['#f2f5ed', '#e4eadc', '#29352a', '#466d32'],
  sand: ['#26221c', '#302b23', '#e9dfcb', '#d2b079'],
  rose: ['#291f26', '#362831', '#efdee6', '#e5a1bc'],
  ocean: ['#15262e', '#1d333e', '#dcebf1', '#78c9dd'],
  aurora: ['#f1f8f8', '#e2eeef', '#243c48', '#197a70'],
  ember: ['#fcf6ef', '#f0e5d9', '#47352a', '#a35426'],
  iris: ['#f8f5fe', '#ece6f6', '#39304c', '#7750b5'],
};
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
  select.value = saved === 'system' ? 'dark' : saved || 'dark'; if (!select.value) select.value = 'dark';
  // Retain existing fixed appearances; new installs and legacy System follow OS.
  appearance.value = localStorage.getItem('org-theme-mode') || (saved && saved !== 'system' ? themes.find(t => t[0] === select.value)[2] : 'system');
  if (!appearance.value) appearance.value = 'system';
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
