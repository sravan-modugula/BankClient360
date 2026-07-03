/* Build an enterprise "layered architecture" diagram as an SVG (banded style, layer name on the
   left, component boxes in a row per band, down-arrows between bands, bottom Data band showing the
   SOR -> VAULT -> SPOT -> ClientIQ flow). Grayscale / black-and-white enterprise. Renders to PNG. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const CHROME = path.join(__dirname, '.pptr-cache/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

const W = 1480;
const BX = 40, BW = 1120;            // band x, width
const LBL0 = 58;                      // layer label x
const CX0 = 250, CX1 = BX + BW - 20;  // component zone
const RIGHT = BX + BW + 72;           // right gutter x (identity)

const F = 'Arial, Helvetica, sans-serif';
const C = { band: '#e9ecef', bandAlt: '#e2e6ea', label: '#1a1a1a', box: '#ffffff', boxBd: '#3a3f45', txt: '#111111', sub: '#333333', arrow: '#555555', flow: '#333333', side: '#f5f5f5', sideBd: '#777777' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let S = '';
function rect(x, y, w, h, fill, rx, stroke, sw, dash) {
  S += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx || 0}" fill="${fill}"` +
    (stroke ? ` stroke="${stroke}" stroke-width="${sw || 1}"` : '') + (dash ? ` stroke-dasharray="${dash}"` : '') + '/>';
}
function text(x, y, str, size, color, weight, anchor) {
  S += `<text x="${x}" y="${y}" font-family="${F}" font-size="${size}" fill="${color || C.txt}"` +
    ` font-weight="${weight || 'normal'}" text-anchor="${anchor || 'start'}">${esc(str)}</text>`;
}
// multi-line centered text block inside a box
function boxText(cx, cy, title, sub) {
  const hasSub = sub && sub.length;
  const ty = hasSub ? cy - 6 : cy + 6;
  text(cx, ty, title, 17, C.txt, 'bold', 'middle');
  if (hasSub) {
    // wrap sub into up to 2 lines by ~34 chars
    const words = sub.split(' '); let l1 = '', l2 = '';
    for (const w of words) { if ((l1 + ' ' + w).trim().length <= 40 || !l1) l1 = (l1 + ' ' + w).trim(); else l2 = (l2 + ' ' + w).trim(); }
    text(cx, ty + 22, l1, 13.5, C.sub, 'normal', 'middle');
    if (l2) text(cx, ty + 40, l2, 13.5, C.sub, 'normal', 'middle');
  }
}
function boxesRow(items, y, h) {
  const n = items.length, g = 24;
  const bw = (CX1 - CX0 - (n - 1) * g) / n;
  const cy = y + h / 2;
  items.forEach((it, i) => {
    const x = CX0 + i * (bw + g);
    rect(x, y, bw, h, C.box, 8, C.boxBd, 1.5);
    boxText(x + bw / 2, cy, it.title, it.sub);
  });
}
function band(y, h, label, items, alt) {
  rect(BX, y, BW, h, alt ? C.bandAlt : C.band, 6);
  // layer label (left, vertically centered, may wrap to 2 lines)
  const parts = label.split('\n');
  const ly = y + h / 2 - (parts.length - 1) * 15 + 8;
  parts.forEach((p, i) => text(LBL0, ly + i * 30, p, 25, C.label, 'bold', 'start'));
  boxesRow(items, y + 26, h - 52);
}
function downArrow(y0, y1) {
  const x = 150;
  S += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1 - 10}" stroke="${C.arrow}" stroke-width="7"/>`;
  S += `<polygon points="${x - 13},${y1 - 12} ${x + 13},${y1 - 12} ${x},${y1 + 4}" fill="${C.arrow}"/>`;
}

// ---- layout ----
const bands = [
  { label: 'Web / Edge', h: 84, alt: true, items: [{ title: 'IIS on Windows Server: TLS 1.3 termination and reverse proxy to Node on port 5000', sub: '' }] },
  { label: 'Presentation', h: 150, items: [
    { title: 'ClientIQ SPA', sub: 'React 18, TypeScript, Material-UI' },
    { title: 'Client-side routing', sub: 'Wouter, URL-driven navigation' },
    { title: 'Server state', sub: 'TanStack React Query' } ] },
  { label: 'Application\n& Business', h: 168, items: [
    { title: 'Middleware chain', sub: 'correlation id, authentication, logging' },
    { title: 'REST API', sub: 'customers, accounts, households, notes, admin, saml' },
    { title: 'Domain services', sub: 'permission, audit, samlRoleMapping, roleTest' } ] },
  { label: 'Data Access', h: 150, items: [
    { title: 'Row-to-DTO adapters', sub: 'PII masking at the boundary' },
    { title: 'SqlServerSearchProvider', sub: 'case-insensitive LIKE search' },
    { title: 'Parameterized mssql', sub: 'raw SQL Server queries' } ] },
];

// compute total height (bands + gaps + data band)
const GAP = 46, TOP = 30;
let y = TOP;
const positions = [];
for (const b of bands) { positions.push({ ...b, y }); y += b.h + GAP; }
const dataY = y, dataH = 176;
const H = dataY + dataH + 34;

// draw bands
positions.forEach((b) => band(b.y, b.h, b.label, b.items, b.alt));
// down arrows between consecutive bands
for (let i = 0; i < positions.length - 1; i++) downArrow(positions[i].y + positions[i].h, positions[i + 1].y);
downArrow(positions[positions.length - 1].y + positions[positions.length - 1].h, dataY);

// ---- Data band: SOR -> VAULT -> SPOT -> ClientIQ ----
rect(BX, dataY, BW, dataH, C.band, 6);
text(LBL0, dataY + dataH / 2 + 8, 'Data', 25, C.label, 'bold', 'start');
const flow = [
  { title: 'SOR', sub: 'Core banking, Synapse' },
  { title: 'VAULT', sub: 'Landing zone' },
  { title: 'SPOT', sub: 'Data platform' },
  { title: 'ClientIQ', sub: 'SQL Server DB', db: true },
];
const n = flow.length, fg = 48;
const fbw = (CX1 - CX0 - (n - 1) * fg) / n;
const fby = dataY + 52, fbh = dataH - 90, fcy = fby + fbh / 2;
flow.forEach((it, i) => {
  const x = CX0 + i * (fbw + fg);
  if (it.db) {
    // cylinder
    const rx = fbw / 2, ry = 12;
    S += `<path d="M${x},${fby + ry} a${rx},${ry} 0 0 1 ${fbw},0 v${fbh - 2 * ry} a${rx},${ry} 0 0 1 ${-fbw},0 z" fill="${C.box}" stroke="${C.boxBd}" stroke-width="1.5"/>`;
    S += `<path d="M${x},${fby + ry} a${rx},${ry} 0 0 0 ${fbw},0" fill="none" stroke="${C.boxBd}" stroke-width="1.5"/>`;
  } else {
    rect(x, fby, fbw, fbh, C.box, 8, C.boxBd, 1.5);
  }
  boxText(x + fbw / 2, fcy, it.title, it.sub);
  if (i < n - 1) {
    const x0 = x + fbw, x1 = CX0 + (i + 1) * (fbw + fg);
    S += `<line x1="${x0 + 6}" y1="${fcy}" x2="${x1 - 12}" y2="${fcy}" stroke="${C.flow}" stroke-width="3"/>`;
    S += `<polygon points="${x1 - 14},${fcy - 7} ${x1 - 14},${fcy + 7} ${x1},${fcy}" fill="${C.flow}"/>`;
    if (i === 2) text((x0 + x1) / 2, fby - 12, 'daily data load', 12.5, C.sub, 'normal', 'middle');
  }
});

// ---- side: Identity provider (linked to Application band) ----
const appB = positions[2];
const idW = 232, idX = RIGHT, idY = appB.y + 20, idH = appB.h - 40, idMid = idY + idH / 2;
rect(idX, idY, idW, idH, C.side, 8, C.sideBd, 1.5, '5,4');
text(idX + idW / 2, idMid - 20, 'Identity provider', 16, C.txt, 'bold', 'middle');
text(idX + idW / 2, idMid + 4, 'RSA SecurID Access (SAML)', 13, C.sub, 'normal', 'middle');
text(idX + idW / 2, idMid + 24, 'Active Directory', 13, C.sub, 'normal', 'middle');
S += `<line x1="${BX + BW}" y1="${idMid}" x2="${idX}" y2="${idMid}" stroke="${C.sideBd}" stroke-width="1.5" stroke-dasharray="4,4"/>`;
text((BX + BW + idX) / 2, idMid - 8, 'SAML / AD', 11.5, C.sub, 'normal', 'middle');

// ---- side: Observability (cross-cutting, spanning Data Access + Data bands) ----
const dacB = positions[3];
const obX = RIGHT, obW = 232, obY = dacB.y + 14, obBottom = dataY + dataH - 12, obH = obBottom - obY, obMid = obY + obH / 2;
rect(obX, obY, obW, obH, C.side, 8, C.sideBd, 1.5, '5,4');
text(obX + obW / 2, obMid - 30, 'Observability', 16, C.txt, 'bold', 'middle');
text(obX + obW / 2, obMid - 6, 'Audit tables, application logs', 12.5, C.sub, 'normal', 'middle');
text(obX + obW / 2, obMid + 14, 'Health checks, alerting', 12.5, C.sub, 'normal', 'middle');
const dacMid = dacB.y + dacB.h / 2;
S += `<line x1="${BX + BW}" y1="${dacMid}" x2="${obX}" y2="${dacMid}" stroke="${C.sideBd}" stroke-width="1.5" stroke-dasharray="4,4"/>`;
text((BX + BW + obX) / 2, dacMid - 8, 'logs / audit', 11.5, C.sub, 'normal', 'middle');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${S}</svg>`;

async function main() {
  const outSvg = path.join(__dirname, 'diagrams', 'architecture-layered.svg');
  const outPng = path.join(__dirname, 'diagrams', 'architecture-layered.png');
  fs.writeFileSync(outSvg, svg);
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 3 });
  await page.setContent(`<!doctype html><html><body style="margin:0;padding:0">${svg}</body></html>`, { waitUntil: 'networkidle0' });
  const el = await page.$('svg');
  await el.screenshot({ path: outPng });
  await browser.close();
  console.log('wrote', outPng, `(${W}x${H} @3x)`);
}
main();
