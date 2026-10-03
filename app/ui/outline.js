// Line numbers are navigation targets, not identities: inserting text shifts them.
// Keep identities in unchanged source regions, then match uniquely named headings
// inside the edited region (including headings moved to another parent).
export function reconcileOutline(previous, source, headings) {
  const before = previous?.source || '', old = previous?.headings || [];
  let prefix = 0, suffix = 0, serial = previous?.serial || 0;
  while (prefix < Math.min(before.length, source.length) && before[prefix] === source[prefix]) prefix++;
  while (suffix < Math.min(before.length, source.length) - prefix && before[before.length - suffix - 1] === source[source.length - suffix - 1]) suffix++;
  const offsets = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') offsets.push(i + 1);
  const next = headings.map(h => ({ ...h, offset: offsets[h.line - 1], end: offsets[h.line] ?? source.length })), used = new Set();
  const positions = new Map(old.map(h => [h.end <= prefix ? h.offset : h.offset >= before.length - suffix ? h.offset + source.length - before.length : -1, h]));
  for (const h of next) {
    const match = positions.get(h.offset);
    if (match && !used.has(match)) { h.key = match.key; used.add(match); }
  }
  const signature = h => `${h.level}:${h.title}`;
  const candidates = new Map(), counts = new Map();
  for (const h of old) if (!used.has(h)) { const key = signature(h); candidates.set(key, candidates.has(key) ? null : h); }
  for (const h of next) if (!h.key) { const key = signature(h); counts.set(key, (counts.get(key) || 0) + 1); }
  for (const h of next) if (!h.key) {
    const key = signature(h), match = counts.get(key) === 1 && candidates.get(key);
    if (match) { h.key = match.key; used.add(match); }
  }
  const unmatched = old.filter(h => !used.has(h)), added = next.filter(h => !h.key);
  if (unmatched.length === 1 && added.length === 1 && unmatched[0].level === added[0].level) added[0].key = unmatched[0].key;
  for (const h of next) h.key ||= `heading-${++serial}`;
  return { source, headings: next, serial };
}
