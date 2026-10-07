/* =========================================================
   server.js — 本機小伺服器（只用 Node 內建模組，免安裝套件）
   功能：
     1) 把本資料夾當成網站提供（靜態檔案）
     2) /kmb/* 代理到官方 API，示範「自己蓋一層 API」
   用法：
     node server.js        然後開 http://localhost:3000
   ========================================================= */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const KMB_HOST = 'data.etabus.gov.hk';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/* ---------- 靜態檔案 ---------- */
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // 防止路徑跳脫（安全性）
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404</h1><p>找不到頁面：' + urlPath + '</p><a href="/">回首頁</a>');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------- 代理到官方 API ---------- */
function proxyKMB(req, res) {
  // /kmb/v1/transport/kmb/route/ -> https://data.etabus.gov.hk/v1/transport/kmb/route/
  const targetPath = req.url.replace(/^\/kmb/, '');
  const options = {
    host: KMB_HOST,
    path: targetPath,
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': 'kmb-api-learning-demo' },
  };

  const proxied = https.request(options, (upstream) => {
    let body = '';
    upstream.on('data', (chunk) => { body += chunk; });
    upstream.on('end', () => {
      res.writeHead(upstream.statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-Proxy': 'local-node-server',
      });
      res.end(body);
    });
  });

  proxied.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: '502', message: 'Upstream error: ' + e.message }));
  });

  proxied.end();
}

/* ---------- 自建 API 範例：/api/hello ---------- */
function apiHello(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    type: 'Hello',
    version: '1.0',
    generated_timestamp: new Date().toISOString(),
    message: '恭喜！這是你自己寫的 API 端點。',
  }, null, 2));
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/kmb/')) return proxyKMB(req, res);
  if (req.url.startsWith('/api/hello')) return apiHello(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n  ✅ KMB API 學習站已啟動`);
  console.log(`  🌐 請用瀏覽器開啟： http://localhost:${PORT}`);
  console.log(`  🔌 代理端點示範：   http://localhost:${PORT}/kmb/v1/transport/kmb/route/`);
  console.log(`  🧪 自建 API 示範：  http://localhost:${PORT}/api/hello\n`);
});
