/** Extract a balanced JSON object that starts at `"key":{` */
export function extractJsonObject(text, key) {
  const marker = `"${key}":`;
  const start = text.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(i, j + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
