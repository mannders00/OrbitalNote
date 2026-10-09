// Source offsets, not an AST rewrite. Blocks and drawers cannot introduce headings.
export function headingRanges(source) {
  const headings = [], stack = [];
  let offset = 0, block = '', drawer = false;
  for (const text of source.split('\n')) {
    const begin = /^\s*#\+begin_(\S+)/i.exec(text);
    if (!block && begin) block = begin[1].toLowerCase();
    if (block) {
      if (text.trim().toLowerCase() === '#+end_' + block) block = '';
    } else if (drawer || /^\s*:[A-Za-z0-9_]+:\s*$/.test(text)) {
      drawer = text.trim().toUpperCase() !== ':END:';
    } else {
      const match = /^(\*+)\s+(.+?)\s*$/.exec(text);
      if (match) {
        const level = match[1].length;
        while (stack.length && stack.at(-1).level >= level) stack.pop().to = offset - 1;
        const heading = { start: offset, from: offset + text.length, to: source.length, level, title: match[2] };
        headings.push(heading); stack.push(heading);
      }
    }
    offset += text.length + 1;
  }
  return headings;
}

// Indented list bodies belong to their item, including continuation paragraphs.
// Blank lines alone don't make an item foldable; blocks/drawers are opaque.
export function listRanges(source) {
  const items = [], stack = [];
  let offset = 0, block = '', drawer = false;
  for (const text of source.split('\n')) {
    const indent = (text.match(/^[ \t]*/)?.[0] || '').replace(/\t/g, '        ').length;
    if (!block && !drawer && text.trim()) {
      while (stack.length && (indent <= stack.at(-1).level || /^\*+\s/.test(text))) stack.pop();
      for (const item of stack) item.to = offset + text.replace(/\r$/, '').length;
    } else if ((block || drawer) && text.trim()) {
      for (const item of stack) item.to = offset + text.replace(/\r$/, '').length;
    }
    const begin = /^\s*#\+begin_(\S+)/i.exec(text);
    if (!block && begin) block = begin[1].toLowerCase();
    if (block) { if (text.trim().toLowerCase() === '#+end_' + block) block = ''; }
    else if (drawer || /^\s*:[A-Za-z0-9_]+:\s*$/.test(text)) drawer = text.trim().toUpperCase() !== ':END:';
    else {
      const match = /^(\s*)([-+]|\d+[.)]|\*)\s+(.+?)\s*$/.exec(text);
      if (match && (match[2] !== '*' || indent > 0)) {
        const item = { start: offset, from: offset + text.replace(/\r$/, '').length, to: offset + text.replace(/\r$/, '').length, level: indent, title: match[3], kind: 'list' };
        items.push(item); stack.push(item);
      }
    }
    offset += text.length + 1;
  }
  return items;
}
