// Bundles public/ into one self-contained HTML file (handy for quick sharing or previews).
// Usage: node tools/build-single.mjs [out=dist/office-royale.html]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const root = new URL('../public/', import.meta.url);
const out = process.argv[2] || 'dist/office-royale.html';
let html = readFileSync(new URL('index.html', root), 'utf8');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, p) => `<style>\n${readFileSync(new URL(p, root), 'utf8')}</style>`);
const local = [...html.matchAll(/<script defer src="(js\/[^"]+)"><\/script>\n?/g)];
const code = local.map(m => `/* ${m[1]} */\n` + readFileSync(new URL(m[1], root), 'utf8')).join('\n');
html = html.replace(/<script defer src="js\/[^"]+"><\/script>\n?/g, '');
html = html.replace('<script defer src="https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js"></script>\n<script>\n(()=>{\n' + code + '\n})();\n</script>');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB');
