// Kleine Markdown-omzetter zonder externe pakketten.
// Ondersteunt: koppen (## en ###), alinea's, opsommingen (- en 1.),
// vet, cursief, links en inline code. Enkele regeleinden worden <br>.
// Bevat de tekst al HTML (bv. uit een rich-text-editor), dan wordt die
// ongewijzigd doorgegeven.

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text) {
  // Ge-escapete tekens (bv. "1\.1." uit een editor) tijdelijk veilig wegzetten
  let s = text.replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, (_, ch) => `\u0000${ch.charCodeAt(0)}\u0000`);
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const safe = /^(https?:|mailto:|tel:|\/|#)/i.test(href) ? href : '#';
    const ext = /^https?:/i.test(safe) ? ' rel="noopener"' : '';
    return `<a href="${safe}"${ext}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, c) => esc(String.fromCharCode(Number(c))));
}

export function parseFrontmatter(src) {
  const text = src.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}

export function markdown(src) {
  const text = (src || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';
  if (/^<[a-z!]/i.test(text)) return text; // al HTML

  const out = [];
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const h = lines[0].match(/^(#{1,4})\s+(.*)$/);
    if (h && lines.length === 1) {
      const level = Math.min(Math.max(h[1].length, 2), 4);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      out.push('<ul>' + lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('') + '</ul>');
      continue;
    }
    if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
      out.push('<ol>' + lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('') + '</ol>');
      continue;
    }
    out.push(`<p>${lines.map(inline).join('<br>')}</p>`);
  }
  return out.join('\n');
}
