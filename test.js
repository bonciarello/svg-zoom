#!/usr/bin/env node
/**
 * Test suite for Convertitore SVG → PNG
 * Validates: HTML structure, SEO, accessibility basics, server responses
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = __dirname;
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.error(`  ✗ FALLITO: ${label}`);
  }
}

function check(label, fn) {
  try {
    fn();
  } catch (e) {
    failed++;
    failures.push(`${label} (eccezione: ${e.message})`);
    console.error(`  ✗ FALLITO: ${label} — ${e.message}`);
  }
}

console.log('\n═══ Test Suite: Convertitore SVG → PNG ═══\n');

// ─── 1. File existence ───────────────────────
console.log('1. Esistenza file');
check('index.html esiste', () => {
  assert(fs.existsSync(path.join(BASE, 'index.html')), 'index.html esiste');
});
check('robots.txt esiste', () => {
  assert(fs.existsSync(path.join(BASE, 'robots.txt')), 'robots.txt esiste');
});
check('sitemap.xml esiste', () => {
  assert(fs.existsSync(path.join(BASE, 'sitemap.xml')), 'sitemap.xml esiste');
});

// ─── 2. HTML content validation ──────────────
console.log('\n2. Validazione HTML');
const html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');

check('DOCTYPE html', () => {
  assert(html.startsWith('<!DOCTYPE html>'), 'DOCTYPE html presente');
});

check('lang="it"', () => {
  assert(/<html[^>]*lang="it"/.test(html), 'Attributo lang="it" su html');
});

check('viewport meta', () => {
  assert(/<meta[^>]*name="viewport"/.test(html), 'Meta viewport presente');
  assert(/<meta[^>]*content="width=device-width,\s*initial-scale=1/.test(html), 'Viewport content corretto');
});

check('<title> unico e descrittivo', () => {
  const titles = html.match(/<title>/g);
  assert(titles && titles.length === 1, 'Un solo tag <title>');
  assert(/Convertitore SVG in PNG/.test(html.match(/<title>([^<]*)<\/title>/)?.[1] || ''), 'Title descrittivo');
});

check('Meta description', () => {
  assert(/<meta[^>]*name="description"/.test(html), 'Meta description presente');
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/);
  assert(descMatch && descMatch[1].length > 40, 'Description sufficientemente lunga');
});

check('Un solo <h1>', () => {
  const h1Count = (html.match(/<h1[\s>]/g) || []).length;
  assert(h1Count === 1, `Un solo h1 (trovati: ${h1Count})`);
});

check('Landmark: header', () => {
  assert(/<header[^>]*/.test(html), 'Elemento <header> presente');
});

check('Landmark: main', () => {
  assert(/<main[^>]*/.test(html), 'Elemento <main> presente');
});

check('Landmark: footer', () => {
  assert(/<footer[^>]*/.test(html), 'Elemento <footer> presente');
});

// ─── 3. SEO ──────────────────────────────────
console.log('\n3. Validazione SEO');

check('Canonical URL', () => {
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/);
  assert(canonical !== null, 'Tag canonical presente');
  assert(canonical && canonical[1].includes('convertitore-di-file-svg-in-png-scalabile-con-anteprima-e-zoom'), 'URL canonical corretto');
});

check('Open Graph tags', () => {
  assert(/<meta[^>]*property="og:title"/.test(html), 'og:title presente');
  assert(/<meta[^>]*property="og:description"/.test(html), 'og:description presente');
  assert(/<meta[^>]*property="og:type"/.test(html), 'og:type presente');
  assert(/<meta[^>]*property="og:url"/.test(html), 'og:url presente');
});

check('JSON-LD', () => {
  assert(/application\/ld\+json/.test(html), 'JSON-LD script presente');
  assert(/"@type"\s*:\s*"WebApplication"/.test(html), 'JSON-LD type WebApplication');
});

check('robots.txt content', () => {
  const robots = fs.readFileSync(path.join(BASE, 'robots.txt'), 'utf-8');
  assert(robots.includes('User-agent'), 'robots.txt contiene User-agent');
  assert(robots.includes('Sitemap:'), 'robots.txt contiene Sitemap');
});

check('sitemap.xml content', () => {
  const sitemap = fs.readFileSync(path.join(BASE, 'sitemap.xml'), 'utf-8');
  assert(sitemap.includes('<urlset'), 'sitemap.xml valido');
  assert(sitemap.includes('<loc>'), 'sitemap.xml contiene URL');
});

// ─── 4. Accessibility ────────────────────────
console.log('\n4. Validazione accessibilità');

check('Label su input', () => {
  // Check for label with for attribute or wrapped input
  const hasLabelFor = /<label[^>]*for="[^"]*"/.test(html);
  const hasAriaLabel = /aria-label="[^"]*"/.test(html);
  assert(hasLabelFor || hasAriaLabel, 'Label o aria-label presenti sugli input');
});

check('Focus visible', () => {
  assert(/:focus-visible/.test(html), 'Stili focus-visible presenti');
});

check('Alt text su immagini', () => {
  const imgTags = html.match(/<img[^>]*>/g) || [];
  const allHaveAlt = imgTags.every(tag => /alt="[^"]*"/.test(tag));
  assert(allHaveAlt, 'Tutte le immagini hanno attributo alt');
});

check('role attributi', () => {
  assert(/role="banner"/.test(html), 'role banner su header');
  assert(/role="contentinfo"/.test(html), 'role contentinfo su footer');
  assert(/role="alert"/.test(html), 'role alert per errori');
});

check('aria-live per aggiornamenti dinamici', () => {
  assert(/aria-live="polite"/.test(html), 'aria-live polite presente');
});

// ─── 5. Technical ────────────────────────────
console.log('\n5. Validazione tecnica');

check('Vue 3 CDN caricato', () => {
  assert(/vue@3\/dist\/vue\.global\.prod\.js/.test(html), 'Vue 3 production CDN');
});

check('Nessun path assoluto (sub-path safety)', () => {
  // Check that src/href in HTML don't start with "/" (except og:url and canonical)
  const dangerousPaths = html.match(/(?:src|href)="\/(?!\/)[^"]*"/g);
  // Filter out og:url, canonical, sitemap URLs that legitimately need absolute URLs
  const realDangerous = (dangerousPaths || []).filter(p => {
    return !p.includes('cristianporco.it') && !p.includes('schema.org') && !p.includes('sitemaps.org');
  });
  assert(realDangerous.length === 0, `Nessun path assoluto non necessario (trovati: ${realDangerous.length})`);
});

check('<base href="./"> presente', () => {
  assert(/<base[^>]*href="\.\/"/.test(html), 'Base href relativo');
});

check('CSS custom properties (design tokens)', () => {
  assert(/--surface:/.test(html), 'CSS token --surface definito');
  assert(/--primary:/.test(html), 'CSS token --primary definito');
  assert(/--font-display:/.test(html), 'CSS token --font-display definito');
  assert(/--font-body:/.test(html), 'CSS token --font-body definito');
  assert(/--font-mono:/.test(html), 'CSS token --font-mono definito');
});

check('prefers-reduced-motion', () => {
  assert(/prefers-reduced-motion/.test(html), 'Media query prefers-reduced-motion presente');
});

// ─── 6. Vue app logic checks ────────────────
console.log('\n6. Validazione logica Vue');

check('Funzione parseSvgDimensions presente', () => {
  assert(/parseSvgDimensions/.test(html), 'Funzione parseSvgDimensions definita');
});

check('Funzione convertSvgToPngBlob presente', () => {
  assert(/convertSvgToPngBlob/.test(html), 'Funzione convertSvgToPngBlob definita');
});

check('Gestione zoom/pan', () => {
  assert(/onWheel/.test(html), 'Handler zoom (wheel)');
  assert(/onPanStart/.test(html), 'Handler pan start');
  assert(/onPanMove/.test(html), 'Handler pan move');
  assert(/onTouchStart/.test(html), 'Handler touch start');
});

check('Scala esportazione 1-5x', () => {
  assert(/min="1"/.test(html) && /max="5"/.test(html), 'Range slider 1-5');
  assert(/exportScale/.test(html), 'Variabile exportScale');
});

// ─── 7. Server test ─────────────────────────
console.log('\n7. Test server HTTP');

// Test server responses
const testServer = (port) => new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = filePath.split('?')[0]; // Remove query params
    const fullPath = path.join(BASE, filePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath);
      const mime = {
        '.html': 'text/html',
        '.txt': 'text/plain',
        '.xml': 'application/xml',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
      }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(fs.readFileSync(fullPath));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, '0.0.0.0', () => {
    resolve(server);
  });
});

(async () => {
  let server;
  try {
    server = await testServer(9876);

    // Test GET /
    const get = (p) => new Promise((resolve, reject) => {
      http.get(`http://localhost:9876${p}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }).on('error', reject);
    });

    const root = await get('/');
    check('GET / → 200', () => {
      assert(root.status === 200, `Status: ${root.status}`);
    });
    check('Content-Type HTML', () => {
      assert((root.headers['content-type'] || '').includes('text/html'), 'Content-Type text/html');
    });

    const robots = await get('/robots.txt');
    check('GET /robots.txt → 200', () => {
      assert(robots.status === 200, `Status: ${robots.status}`);
    });

    const sitemap = await get('/sitemap.xml');
    check('GET /sitemap.xml → 200', () => {
      assert(sitemap.status === 200, `Status: ${sitemap.status}`);
    });

    const notFound = await get('/nonexistent');
    check('GET /nonexistent → 404', () => {
      assert(notFound.status === 404, `Status: ${notFound.status}`);
    });

  } catch (e) {
    failed++;
    failures.push(`Server test: ${e.message}`);
    console.error(`  ✗ FALLITO: Server test — ${e.message}`);
  } finally {
    if (server) server.close();
  }

  // ─── Summary ───────────────────────────────
  console.log(`\n═══ Riepilogo: ${passed} passati, ${failed} falliti su ${passed + failed} test ═══`);
  if (failures.length > 0) {
    console.log('\nDettaglio fallimenti:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }

  process.exit(failed > 0 ? 1 : 0);
})();
