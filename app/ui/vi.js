import { replaceSelection } from './editor.js';

// A deliberately small vi layer. Edits use the editor's source-preserving
// transaction and undo path, just like ordinary typing.
export function attachVi(editor, status, findPrompt) {
  let enabled = false, mode = 'normal', pending = '', count = '', anchor = 0;
  let register = '', linewise = false, search = '';
  // Textarea caret-shape support varies across native WebViews. Mirror its
  // layout and scrolling to draw a block without changing the text selection.
  const cursorLayer = document.createElement('pre');
  cursorLayer.className = 'vi-cursor-layer';
  cursorLayer.setAttribute('aria-hidden', 'true');
  const beforeCursor = document.createTextNode(''), afterCursor = document.createTextNode('');
  const cursor = document.createElement('span'); cursor.className = 'vi-block-cursor';
  cursorLayer.append(beforeCursor, cursor, afterCursor);
  const cursorHost = editor.closest('.source-pane') || editor.parentElement;
  cursorHost.append(cursorLayer);
  if (editor.caretRect) cursorLayer.classList.add('rich-vi-cursor');
  function drawCursor() {
    const visible = enabled && mode === 'normal' && document.activeElement === editor;
    cursorLayer.hidden = !visible;
    editor.dataset.viMode = enabled ? mode : '';
    if (!visible) return;
    if (editor.caretRect) {
      const rect = editor.caretRect(), host = cursorHost.getBoundingClientRect();
      if (!rect) { cursorLayer.hidden = true; return; }
      cursor.style.cssText = `position:absolute;left:${rect.left - host.left}px;top:${rect.top - host.top}px;height:${rect.bottom - rect.top}px`;
      return;
    }
    const p = editor.selectionStart;
    beforeCursor.textContent = editor.value.slice(0, p);
    afterCursor.textContent = editor.value.slice(p) + '\n';
    cursorLayer.scrollTop = editor.scrollTop;
    cursorLayer.scrollLeft = editor.scrollLeft;
  }
  for (const event of ['focus', 'blur', 'input', 'editor-input', 'editor-selection', 'click', 'keyup', 'scroll', 'select']) editor.addEventListener(event, drawCursor);
  editor.viewport?.addEventListener('scroll', drawCursor);
  const selectionChanged = () => { if (document.activeElement === editor) drawCursor(); };
  document.addEventListener('selectionchange', selectionChanged);
  const start = p => editor.value.lastIndexOf('\n', p - 1) + 1;
  const end = p => { const n = editor.value.indexOf('\n', p); return n < 0 ? editor.value.length : n; };
  const pos = () => mode === 'visual' ? (editor.selectionDirection === 'backward' ? editor.selectionStart : Math.max(editor.selectionStart, editor.selectionEnd - 1)) : editor.selectionStart;
  function report() { status.textContent = enabled ? `${mode.toUpperCase()}${pending || count ? ' · ' + count + pending : ''}` : ''; status.hidden = !enabled; drawCursor(); }
  function reset() { mode = 'normal'; pending = ''; count = ''; report(); }
  function move(p) {
    p = Math.max(0, Math.min(editor.value.length, p));
    if (mode === 'visual') editor.setSelectionRange(Math.min(anchor,p), Math.min(editor.value.length,Math.max(anchor,p)+1), p < anchor ? 'backward' : 'forward');
    else editor.setSelectionRange(p,p);
    reveal();
    editor.dispatchEvent(new Event('scroll'));
    editor.dispatchEvent(new Event('click'));
  }
  function reveal() {
    if (editor.reveal) { editor.reveal(); drawCursor(); return; }
    // Measure the mirrored caret: logical line numbers no longer correspond to
    // visual rows once a paragraph wraps, especially in a resized split.
    const p = editor.selectionStart, hidden = cursorLayer.hidden;
    cursorLayer.hidden = false;
    beforeCursor.textContent = editor.value.slice(0, p);
    afterCursor.textContent = editor.value.slice(p) + '\n';
    const css = getComputedStyle(editor), height = parseFloat(css.lineHeight);
    const top = cursor.getBoundingClientRect().top - cursorLayer.getBoundingClientRect().top + cursorLayer.scrollTop;
    if (top < editor.scrollTop) editor.scrollTop = top;
    if (top + height > editor.scrollTop + editor.clientHeight) editor.scrollTop = top + height - editor.clientHeight;
    cursorLayer.hidden = hidden;
    drawCursor();
  }
  function motion(key, p, n) {
    const text = editor.value;
    for (let i=0; i<n; i++) {
      if (key==='h') p=Math.max(start(p),p-1);
      else if (key==='l') p=Math.min(end(p),p+1);
      else if (key==='0') p=start(p);
      else if (key==='^') p=start(p)+(text.slice(start(p),end(p)).match(/^\s*/)?.[0].length || 0);
      else if (key==='$') p=end(p);
      else if (key==='j') { const e=end(p); p=e<text.length ? Math.min(e+1+p-start(p),end(e+1)) : p; }
      else if (key==='k') { const s=start(p); p=s ? Math.min(start(s-1)+p-s,s-1) : p; }
      else if (key==='w') { const m=text.slice(p).match(/^(?:\w+|[^\w\s]+)?\s*/); p+=Math.max(1,m[0].length); p=Math.min(p,text.length); }
      else if (key==='b') { const m=text.slice(0,p).match(/(?:\w+|[^\w\s]+)\s*$/); p=m ? p-m[0].length : 0; }
      else if (key==='G') p=text.length;
    }
    return p;
  }
  function edit(a,b,text='') { replaceSelection(editor,text,a,b); }
  function operate(op,a,b,lines=false) {
    register=editor.value.slice(a,b); linewise=lines;
    if (op!=='y') edit(a,b);
    reset(); move(a);
    if (op==='c') { mode='insert'; report(); }
  }
  editor.addEventListener('keydown', e => {
    if (e.target.closest('button')) return;
    if (!enabled || e.isComposing || e.altKey || e.metaKey) return;
    if (e.ctrlKey && !(['r', 'd', 'u', 'e', 'y'].includes(e.key.toLowerCase()) && mode !== 'insert')) return;
    if (mode==='insert' && e.key!=='Escape') return;
    if (e.key.length>1 && !['Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Backspace','Enter','Delete'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    let key = {ArrowLeft:'h',ArrowRight:'l',ArrowUp:'k',ArrowDown:'j'}[e.key] || e.key;
    const p=pos();
    if (key==='Escape') { reset(); move(p); return; }
     if (pending !== 'R' && (/^[1-9]$/.test(key) || (key==='0' && count))) { count=(count+key).slice(0,4); report(); return; }
    const n=Math.min(Number(count)||1,999); count='';
    if (e.ctrlKey && ['d', 'u', 'e', 'y'].includes(key)) {
      pending = '';
      const direction = ['d', 'e'].includes(key) ? 1 : -1, halfPage = ['d', 'u'].includes(key);
      if (editor.scrollVi) editor.scrollVi(direction, halfPage, n);
      else move(motion(direction > 0 ? 'j' : 'k', p, (halfPage ? Math.max(1, Math.floor(editor.clientHeight / parseFloat(getComputedStyle(editor).lineHeight) / 2)) : 1) * n));
      report(); return;
    }
     if (pending === 'R') {
       pending = '';
       if (key.length === 1) {
         const a = editor.selectionStart, b = Math.max(editor.selectionEnd, Math.min(end(a), a + n));
         edit(a, b, editor.value.slice(a, b).replace(/[^\n]/g, () => key)); reset(); move(a);
       }
       report(); return;
     }
     if (pending==='g') { pending=''; if(key==='g') move(0); report(); return; }
    if (pending) {
      const op=pending; pending='';
      if (key===op) { let b=p; for(let i=0;i<n;i++) b=Math.min(editor.value.length,end(b)+1); operate(op,start(p),b,true); }
      else if ('hjklw b0^$G'.includes(key)) { const q=motion(key,p,n); operate(op,Math.min(p,q),Math.max(p,q)); }
      report(); return;
    }
    if ('hjklwb0^$G'.includes(key) && key.length===1) { move(motion(key,p,n)); return; }
     if (!e.ctrlKey && (key === 'R' || key === 'r')) { pending = 'R'; count = n > 1 ? String(n) : ''; }
     else if (key==='g') pending='g';
    else if (['d','c','y'].includes(key)) {
      if (mode==='visual') operate(key,editor.selectionStart,editor.selectionEnd);
      else { pending=key; count=n>1 ? String(n) : ''; }
    } else if (key==='v') { if(mode==='visual') {reset();move(p);} else {mode='visual';anchor=p;move(p);} }
    else if (['i','a','I','A'].includes(key)) { reset(); move(key==='a' ? Math.min(end(p),p+1) : key==='I' ? motion('^',p,1) : key==='A' ? end(p) : p); mode='insert'; }
    else if (key==='o' || key==='O') { reset(); const q=key==='o'?end(p):start(p); edit(q,q,'\n'); move(key==='o'?q+1:q); mode='insert'; }
    else if (key==='x' || key==='Delete') { if(mode==='visual') operate('d',editor.selectionStart,editor.selectionEnd); else operate('d',p,Math.min(end(p),p+n)); }
    else if (key==='D' || key==='C') operate(key==='D'?'d':'c',p,end(p));
    else if (key==='p' || key==='P') {
      if(register) { const q=linewise ? (key==='p'?Math.min(editor.value.length,end(p)+1):start(p)) : Math.min(end(p),p+(key==='p'?1:0));
        let text=register; if(linewise && !text.endsWith('\n')) text+='\n';
        if(linewise && key==='p' && q===editor.value.length && q>0 && editor.value[q-1]!=='\n') text='\n'+text;
        edit(q,q,text.repeat(n)); reset(); move(q); }
    } else if (key==='u') { if (editor.undo) editor.undo(); else document.execCommand('undo'); reset(); }
    else if (e.ctrlKey && key==='r') { if (editor.redo) editor.redo(); else document.execCommand('redo'); reset(); }
     else if (key==='/') { Promise.resolve(findPrompt?.(search)).then(value => { if(value && editor.isConnected && !editor.closest('[hidden], [inert]')) {search=value;editor.focus();find(false);} }); }
    else if (key==='n' || key==='N') find(key==='N');
    report();
  }, true);
  function find(backward) {
    if(!search) return;
    const text=editor.value,p=pos();
    let q=backward ? text.lastIndexOf(search,p-1) : text.indexOf(search,p+1);
    if(q<0) q=backward ? text.lastIndexOf(search) : text.indexOf(search);
    if(q>=0) move(q);
  }
  // Prevent accidental text input/paste while in normal or visual mode.
  editor.addEventListener('beforeinput', e => { if(enabled && mode!=='insert' && e.isTrusted && !['historyUndo','historyRedo','insertText','deleteContentBackward'].includes(e.inputType)) e.preventDefault(); });
  return { setEnabled(value) { enabled=value; reset(); }, reset, reveal, dispose() { document.removeEventListener('selectionchange', selectionChanged); } };
}
