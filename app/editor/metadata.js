// View ranges only. Never serialize drawers or history back into the Org source.
const drawerStart = /^\s*:([\w@#%+-]+):\s*$/;
const stateChange = /^\s*[-+]\s+State\s+"[^"]+"\s+from\s+"[^"]*"\s+\[\d{4}-\d{2}-\d{2}[^\]]*\]/;
const clock = /^\s*CLOCK:\s*\[\d{4}-\d{2}-\d{2}[^\]]*\](?:\s*(?:--|–)\s*\[[^\]]*\]\s*=>\s*\d+:\d+)?\s*$/;
const history = text => stateChange.test(text) || clock.test(text);

export function metadataRanges(source) {
  let offset = 0, block = '', headingStart = -1;
  const lines = source.split('\n').map(raw => {
    const line = { text: raw.replace(/\r$/, ''), from: offset };
    offset += raw.length + 1;
    line.to = line.from + line.text.length;
    return line;
  });
  const ranges = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], begin = /^\s*#\+begin_(\S+)/i.exec(line.text);
    if (!block && begin) block = begin[1].toLowerCase();
    if (block) { if (line.text.trim().toLowerCase() === '#+end_' + block) block = ''; continue; }
    if (/^\*+\s+/.test(line.text)) { headingStart = line.from; continue; }
    const drawer = drawerStart.exec(line.text);
    if (drawer && drawer[1].toUpperCase() !== 'END') {
      let end = i + 1;
      while (end < lines.length && !/^\*+\s+/.test(lines[end].text) && !/^\s*:END:\s*$/i.test(lines[end].text)) end++;
      // An unclosed drawer must not hide the rest of the note or a sibling.
      if (end >= lines.length || !/^\s*:END:\s*$/i.test(lines[end].text)) continue;
      const name = drawer[1].toUpperCase(), label = name;
      ranges.push({ start: line.from, from: line.from, to: lines[end].to, headingStart, label, kind: name });
      i = end;
    } else if (history(line.text)) {
      let end = i;
      while (end + 1 < lines.length && history(lines[end + 1].text)) end++;
      ranges.push({ start: line.from, from: line.from, to: lines[end].to, headingStart, label: stateChange.test(line.text) ? 'HISTORY' : 'CLOCK HISTORY', kind: 'HISTORY' });
      i = end;
    }
  }
  return ranges;
}
