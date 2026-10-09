import { escapeHTML as esc } from './editor.js';
import { icon } from './icons.js';
import { patchHTML } from './dom.js';

// Tabs own their DOM; groups only move those surfaces. Moving a note therefore
// preserves its buffer, selection, undo history, and edit/preview mode.
export class TabLayout {
  constructor(root, { activate, close, changed }) {
    this.root = root;
    this.callbacks = { activate, close, changed };
    this.tabs = new Map();
    this.serial = 0;
    this.tree = this.group();
    this.focused = this.tree.id;
    this.dragged = null;
    this.dropMarker = document.createElement('div'); this.dropMarker.className = 'tab-insertion-marker'; this.dropMarker.hidden = true;
    this.dropMarker.setAttribute('aria-hidden', 'true'); root.append(this.dropMarker);
    this.surfaces = new Map();
    this.dividers = new Map();
    this.leftControl = document.getElementById('menu');
    this.rightControl = document.getElementById('context-toggle');
    this.toolbar = document.querySelector('.topbar');
    new ResizeObserver(() => this.position()).observe(root);
    this.stripObserver = new ResizeObserver(() => this.position());
    root.addEventListener('pointerdown', e => {
      const group = e.target.closest('[data-group], [data-owner-group]');
      const id = group?.dataset.group || group?.dataset.ownerGroup;
      if (id && id !== this.focused) this.focus(id);
    });
    root.addEventListener('focusin', e => {
      const group = e.target.closest('[data-group], [data-owner-group]');
      const id = group?.dataset.group || group?.dataset.ownerGroup;
      if (id && id !== this.focused) this.focus(id);
    });
    root.addEventListener('click', e => {
      const close = e.target.closest('[data-tab-close]');
      if (close) { this.callbacks.close(close.dataset.tabClose); return; }
      const tab = e.target.closest('[data-tab-select]');
      if (tab) this.select(tab.dataset.tabSelect);
    });
    root.addEventListener('dragstart', e => {
      const tab = e.target.closest('[data-tab-id]');
      if (!tab) return;
      this.dragged = tab.dataset.tabId;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-orbitalnote-tab', this.dragged);
      e.dataTransfer.setData('text/plain', this.tabs.get(this.dragged).title);
    });
    root.addEventListener('dragover', e => {
      if (!this.dragged) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      this.dragPoint = {target:e.target, clientX:e.clientX, clientY:e.clientY};
      if (this.dragFrame) return;
      this.dragFrame = requestAnimationFrame(() => {
      this.dragFrame = 0;
      const point = this.dragPoint, target = this.dropTarget(point); if (!target || !this.dragged) return;
      this.clearDrop();
      if (target.strip) {
        const rect = target.strip.getBoundingClientRect();
        this.dropMarker.hidden = false;
        this.dropMarker.style.cssText = `left:${target.x}px;top:${rect.top + 5}px;height:${rect.height - 7}px`;
        const items = target.strip.querySelector('.tab-items'), box = items.getBoundingClientRect();
        if (point.clientX < box.left + 24) items.scrollLeft -= 12;
        else if (point.clientX > box.right - 24) items.scrollLeft += 12;
      } else target.element.dataset.drop = target.edge;
      });
    });
    root.addEventListener('dragleave', e => { if (!root.contains(e.relatedTarget)) this.clearDrop(); });
    root.addEventListener('dragend', () => { this.dragged = null; this.clearDrop(); });
    root.addEventListener('drop', e => {
      if (!this.dragged) return;
      const target = this.dropTarget(e), id = this.dragged;
      this.dragged = null; this.clearDrop();
      if (!target) return;
      e.preventDefault(); e.stopPropagation();
      this.move(id, target.group, target.edge, target.before);
    });
  }
  group() { return { id: `group-${++this.serial}`, tabs: [], active: null }; }
  groups(node = this.tree) { return node.children ? node.children.flatMap(child => this.groups(child)) : [node]; }
  owner(id) { return this.groups().find(group => group.tabs.includes(id)); }
  focusedGroup() { return this.groups().find(group => group.id === this.focused) || this.groups()[0]; }
  focusDirection(direction) {
    const current = this.root.querySelector(`[data-group="${this.focused}"]`)?.getBoundingClientRect();
    if (!current) return;
    const horizontal = direction === 'h' || direction === 'l', forward = direction === 'l' || direction === 'j';
    const center = r => horizontal ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2;
    const cross = r => horizontal ? (r.top + r.bottom) / 2 : (r.left + r.right) / 2;
    const candidates = this.groups().filter(g => g.id !== this.focused).map(g => {
      const rect = this.root.querySelector(`[data-group="${g.id}"]`).getBoundingClientRect();
      const distance = (center(rect) - center(current)) * (forward ? 1 : -1);
      return { id: g.id, distance, score: distance + 2 * Math.abs(cross(rect) - cross(current)) };
    }).filter(g => g.distance > 1).sort((a, b) => a.score - b.score);
    if (candidates.length) this.focus(candidates[0].id, true);
  }
  open(id, tab, activate = true) {
    this.tabs.set(id, tab);
    if (!this.owner(id)) { const group = this.focusedGroup(); group.tabs.push(id); group.active ||= id; }
    if (activate) this.select(id); else this.render();
  }
  select(id) {
    const group = this.owner(id); if (!group) return;
    group.active = id; this.focused = group.id;
    this.render(); this.callbacks.activate(id, true); this.changed();
  }
  focus(id, restoreFocus = false) {
    this.focused = id;
    this.placeControls();
    this.root.querySelectorAll('[data-group]').forEach(el => el.classList.toggle('focused', el.dataset.group === id));
    const active = this.focusedGroup().active;
    if (active) this.callbacks.activate(active, restoreFocus);
    this.changed();
  }
  remove(id) {
    const group = this.owner(id); if (!group) return;
    const index = group.tabs.indexOf(id);
    group.tabs.splice(index, 1);
    if (group.active === id) group.active = group.tabs[Math.min(index, group.tabs.length - 1)] || null;
    this.tabs.get(id)?.element.remove(); this.tabs.delete(id);
    this.compact(); this.render(); this.focus(this.focusedGroup().id, true);
  }
  rename(from, to, tab) {
    const group = this.owner(from); if (!group) return;
    group.tabs[group.tabs.indexOf(from)] = to;
    if (group.active === from) group.active = to;
    this.tabs.delete(from); this.tabs.set(to, tab);
    const surface = this.surfaces.get(from);
    if (surface) { this.surfaces.delete(from); this.surfaces.set(to, surface); }
  }
  compact() {
    const prune = node => {
      if (!node.children) return node.tabs.length ? node : null;
      const children = node.children.map(prune).filter(Boolean);
      return children.length === 2 ? { ...node, children } : children[0] || null;
    };
    this.tree = prune(this.tree) || this.group();
    if (!this.groups().some(group => group.id === this.focused)) this.focused = this.groups()[0].id;
  }
  move(id, targetID, edge = 'center', before) {
    const from = this.owner(id), target = this.groups().find(group => group.id === targetID);
    if (!from || !target || (from === target && from.tabs.length === 1 && edge !== 'center')) return;
    if (before === id) return;
    const fromIndex = from.tabs.indexOf(id);
    from.tabs.splice(fromIndex, 1);
    if (from.active === id) from.active = from.tabs[Math.min(fromIndex, from.tabs.length - 1)] || null;
    let destination = target;
    if (edge !== 'center') {
      destination = this.group();
      const children = ['left', 'top'].includes(edge) ? [destination, target] : [target, destination];
      const branch = { axis: ['left', 'right'].includes(edge) ? 'horizontal' : 'vertical', ratio: .5, children };
      const replace = node => node === target ? branch : node.children ? { ...node, children: node.children.map(replace) } : node;
      this.tree = replace(this.tree);
    }
    const index = destination.tabs.indexOf(before);
    destination.tabs.splice(index < 0 ? destination.tabs.length : index, 0, id);
    destination.active = id; this.focused = destination.id;
    this.compact(); this.render(); this.callbacks.activate(id, true); this.changed();
  }
  dropTarget(e) {
    const owner = e.target.closest('[data-group], [data-owner-group]');
    const id = owner?.dataset.group || owner?.dataset.ownerGroup;
    const element = this.root.querySelector(`[data-group="${id}"]`); if (!element) return null;
    let edge = 'center';
    const strip = e.target.closest('.tab-strip');
    if (!strip) {
      const rect = element.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width, y = (e.clientY - rect.top) / rect.height;
      const distances = { left: x, right: 1 - x, top: y, bottom: 1 - y };
      const nearest = Object.keys(distances).sort((a, b) => distances[a] - distances[b])[0];
      if (distances[nearest] < .25) edge = nearest;
    }
    if (strip) {
      const tabs = [...strip.querySelectorAll('[data-tab-id]')].filter(tab => tab.dataset.tabId !== this.dragged);
      const next = tabs.find(tab => { const r = tab.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; });
      const box = strip.querySelector('.tab-items').getBoundingClientRect();
      const x = next ? next.getBoundingClientRect().left : tabs.at(-1)?.getBoundingClientRect().right || box.left;
      return { element, group: element.dataset.group, edge, strip, before: next?.dataset.tabId, x: Math.max(box.left, Math.min(box.right, x)) };
    }
    return { element, group: element.dataset.group, edge };
  }
  clearDrop() { if (this.dragFrame) cancelAnimationFrame(this.dragFrame); this.dragFrame = 0; this.dropMarker.hidden = true; this.root.querySelectorAll('[data-drop]').forEach(el => delete el.dataset.drop); }
  changed() { this.callbacks.changed?.(this.snapshot()); }
  snapshot() { return { tree: this.tree, focused: this.focused }; }
  restore(saved) {
    const seen = new Set();
    const read = (node, depth = 0) => {
      if (!node || depth > 12) return null;
      if (Array.isArray(node.children)) {
        const children = node.children.slice(0, 2).map(child => read(child, depth + 1)).filter(Boolean);
        return children.length === 2 ? { axis: node.axis === 'vertical' ? 'vertical' : 'horizontal', ratio: Math.max(.15, Math.min(.85, Number(node.ratio) || .5)), children } : children[0];
      }
      const group = this.group();
      group.tabs = (Array.isArray(node.tabs) ? node.tabs : []).filter(id => this.tabs.has(id) && !seen.has(id) && seen.add(id));
      group.active = group.tabs.includes(node.active) ? node.active : group.tabs[0];
      if (node.id === saved.focused) this.focused = group.id;
      return group.tabs.length ? group : null;
    };
    const tree = read(saved.tree); if (!tree) return;
    this.tree = tree;
    for (const id of this.tabs.keys()) if (!seen.has(id)) this.groups()[0].tabs.push(id);
    this.render(); this.focus(this.focusedGroup().id);
  }
  reset() {
    for (const tab of this.tabs.values()) tab.element.remove();
    this.tabs.clear(); this.tree = this.group(); this.focused = this.tree.id; this.render();
  }
  render() {
    // Each surface has a permanent DOM parent. Splitting/reordering only changes
    // geometry and ownership, preserving editor state, focus and undo history.
    const existing = new Map([...this.root.querySelectorAll('[data-group]')].map(el => [el.dataset.group, el]));
    const groups = this.groups();
    for (const [id, el] of existing) if (!groups.some(group => group.id === id)) { this.stripObserver.unobserve(el.querySelector('.tab-strip')); el.remove(); existing.delete(id); }
    for (const [id, surface] of this.surfaces) if (!this.tabs.has(id)) { surface.remove(); this.surfaces.delete(id); }
    for (const node of groups) {
      const group = existing.get(node.id) || document.createElement('section');
      if (!group.isConnected) this.root.append(group);
      group.className = `tab-group${node.id === this.focused ? ' focused' : ''}`; group.dataset.group = node.id;
      if (!group.firstChild) {
        group.innerHTML = '<div class="tab-strip"><span class="tab-control-slot tab-left-slot"></span><div class="tab-items" role="tablist" aria-label="Open tabs"></div><span class="tab-control-slot tab-right-slot"></span></div>';
        this.stripObserver.observe(group.firstChild);
        group.querySelector('.tab-items').addEventListener('scroll', () => this.updateTabBaselines());
      }
      const strip = group.querySelector('.tab-items');
      patchHTML(strip, node.tabs.map(id => {
        const tab = this.tabs.get(id);
        return `<div class="tab ${id === node.active ? 'active' : ''}" draggable="true" data-tab-id="${esc(id)}"><button role="tab" aria-selected="${id === node.active}" data-tab-select="${esc(id)}" title="${esc(tab.title)}">${icon(tab.icon)}<span class="tab-label">${esc(tab.title)}</span>${tab.dirty ? '<span class="dirty-dot">•</span>' : ''}</button><button class="icon-button close-tab" data-tab-close="${esc(id)}" aria-label="Close ${esc(tab.title)}">${icon('close')}</button></div>`;
      }).join(''));
      for (const id of node.tabs) {
        const element = this.tabs.get(id).element;
        let surface = this.surfaces.get(id);
        if (!surface) {
          surface = document.createElement('div'); surface.className = 'tab-surface';
          surface.append(element); this.root.append(surface); this.surfaces.set(id, surface);
        }
        surface.dataset.ownerGroup = node.id;
        if (id !== node.active && surface.contains(document.activeElement)) document.activeElement.blur();
        surface.inert = id !== node.active;
        surface.hidden = id !== node.active;
        element.hidden = id !== node.active;
      }
    }
    const branches = node => node.children ? [node, ...node.children.flatMap(branches)] : [];
    const splits = branches(this.tree);
    for (const [node, divider] of this.dividers) if (!splits.includes(node)) { divider.remove(); this.dividers.delete(node); }
    for (const node of splits) {
      if (this.dividers.has(node)) continue;
      const divider = document.createElement('div'); divider.className = `split-divider ${node.axis}`; divider.tabIndex = 0;
      divider.setAttribute('role', 'separator'); divider.setAttribute('aria-label', 'Resize split');
      divider.setAttribute('aria-orientation', node.axis === 'horizontal' ? 'vertical' : 'horizontal');
      const resize = ratio => { node.ratio = Math.max(.15, Math.min(.85, ratio)); this.position(); };
      divider.addEventListener('pointerdown', e => { e.preventDefault(); divider.setPointerCapture(e.pointerId); });
      divider.addEventListener('pointermove', e => {
        if (!divider.hasPointerCapture(e.pointerId)) return;
        const root = this.root.getBoundingClientRect(), rect = divider.region;
        resize(node.axis === 'horizontal' ? (e.clientX - root.left - rect.x) / rect.width : (e.clientY - root.top - rect.y) / rect.height);
      });
      divider.addEventListener('pointerup', e => { if (divider.hasPointerCapture(e.pointerId)) divider.releasePointerCapture(e.pointerId); this.changed(); });
      divider.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); resize(node.ratio + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -.05 : .05)); this.changed();
      });
      this.root.append(divider); this.dividers.set(node, divider);
    }
    this.position();
    this.placeControls();
  }
  placeControls() {
    const strip = this.root.querySelector(`[data-group="${this.focusedGroup().id}"] .tab-strip`);
    if (!strip) return;
    const left = strip.querySelector('.tab-left-slot'), right = strip.querySelector('.tab-right-slot');
    if (this.leftControl.parentElement !== left) left.append(this.leftControl);
    if (this.rightControl.parentElement !== right) right.append(this.rightControl);
    this.toolbar.remove();
    this.updateTabBaselines();
  }
  updateTabBaselines() {
    // Mobile Files is a fixed overlay beside this layout. Follow the actual
    // control-bearing tab strip (themes vary its height), not a 40px constant.
    const controlStrip = this.leftControl.closest('.tab-strip');
    if (controlStrip) {
      const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      document.documentElement.style.setProperty('--mobile-file-sidebar-top', `${controlStrip.getBoundingClientRect().bottom / zoom}px`);
    }
    for (const strip of this.root.querySelectorAll('.tab-strip')) {
      const active = strip.querySelector('.tab.active'), bounds = strip.getBoundingClientRect();
      strip.style.setProperty('--traffic-inset', document.documentElement.dataset.mergedTitlebar === 'true' && bounds.top < 5 ? `${Math.max(5, 82 - bounds.left)}px` : '5px');
      let start = 0, end = 0;
      if (active && bounds.width) {
        const tab = active.getBoundingClientRect(), viewport = strip.querySelector('.tab-items').getBoundingClientRect();
        const left = Math.max(viewport.left, Math.min(viewport.right, tab.left));
        const right = Math.max(left, Math.min(viewport.right, tab.right));
        start = (left - bounds.left) / bounds.width * 100;
        end = (right - bounds.left) / bounds.width * 100;
      }
      strip.style.setProperty('--active-tab-start', `${start}%`);
      strip.style.setProperty('--active-tab-end', `${end}%`);
    }
  }
  position() {
    const place = (el, x, y, width, height) => {
      const geometry = `${x},${y},${width},${height}`;
      if (el.layoutGeometry === geometry) return false;
      el.layoutGeometry = geometry;
      Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, width)}px`, height: `${Math.max(0, height)}px` }); return true;
    };
    const visit = (node, x, y, width, height) => {
      if (!node.children) {
        const group = this.root.querySelector(`[data-group="${node.id}"]`);
        if (group) place(group, x, y, width, height);
        const stripHeight = group ? parseFloat(getComputedStyle(group.querySelector('.tab-strip')).height) || 36 : 36;
        for (const id of node.tabs) { const surface = this.surfaces.get(id); if (surface) { const moved = place(surface, x, y + stripHeight, width, height - stripHeight); if (moved && !surface.hidden) surface.querySelector('[data-ui="source"]')?.refresh?.(); } }
        return;
      }
      const horizontal = node.axis === 'horizontal', size = Math.max(0, (horizontal ? width : height) - 1), first = size * node.ratio;
      const divider = this.dividers.get(node);
      if (divider) {
        divider.region = { x, y, width, height };
        divider.setAttribute('aria-valuenow', Math.round(node.ratio * 100));
        place(divider, horizontal ? x + first - 2 : x, horizontal ? y : y + first - 2, horizontal ? 5 : width, horizontal ? height : 5);
      }
      visit(node.children[0], x, y, horizontal ? first : width, horizontal ? height : first);
      visit(node.children[1], horizontal ? x + first + 1 : x, horizontal ? y : y + first + 1, horizontal ? size - first : width, horizontal ? height : size - first);
    };
    visit(this.tree, 0, 0, this.root.clientWidth, this.root.clientHeight);
    this.updateTabBaselines();
  }
}
