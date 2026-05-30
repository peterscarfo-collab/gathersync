import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mdPath = path.resolve(rootDir, '../marketing/GatherSync-Dashboard-Help-Tutorials.md');
const outDir = path.join(rootDir, 'public/documents');
const htmlPath = path.join(outDir, 'GatherSync-User-Guide.html');
const pdfPath = path.join(outDir, 'GatherSync-User-Guide.pdf');

fs.mkdirSync(outDir, { recursive: true });

const md = fs.readFileSync(mdPath, 'utf8');
const bodyHtml = marked.parse(md);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>GatherSync User Guide</title>
  <style>
    @page { margin: 18mm 16mm; size: A4; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      margin: 0;
    }
    h1 { font-size: 22pt; color: #5b21b6; margin-top: 0; page-break-after: avoid; }
    h2 { font-size: 15pt; color: #5b21b6; margin-top: 1.4em; page-break-after: avoid; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
    h3 { font-size: 12pt; margin-top: 1em; page-break-after: avoid; }
    p, li { orphans: 3; widows: 3; }
    ul, ol { padding-left: 1.4em; }
    li { margin-bottom: 0.25em; }
    strong { color: #111; }
    em { color: #4b5563; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

fs.writeFileSync(htmlPath, html);

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
execFileSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--run-all-compositor-stages-before-draw',
  '--virtual-time-budget=10000',
  `--print-to-pdf=${pdfPath}`,
  `file://${htmlPath}`,
], { stdio: 'inherit' });

console.log(`HTML written to ${htmlPath} (${html.length} chars)`);
console.log(`PDF written to ${pdfPath}`);
