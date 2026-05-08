import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5174);
const searchHosts = [
  'https://iv.melmac.space',
  'https://invidious.privacydev.net',
  'https://invidious.fdn.fr',
  'https://inv.nadeko.net'
];

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/search') {
      await proxySearch(url, res);
      return;
    }

    if (url.pathname === '/api/music') {
      await proxyMusic(url, res);
      return;
    }

    if (url.pathname === '/api/suggest') {
      await proxySuggest(url, res);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: 'Server error', detail: error.message });
  }
});

server.listen(port, () => {
  console.log(`Air Beats running at http://localhost:${port}`);
});

async function proxySearch(url, res) {
  const query = (url.searchParams.get('q') || '').trim();
  if (!query) {
    sendJson(res, 400, { error: 'Missing q parameter' });
    return;
  }

  const params = new URLSearchParams({
    q: query,
    type: url.searchParams.get('type') || 'video',
    page: url.searchParams.get('page') || '1'
  });

  const errors = [];
  for (const host of searchHosts) {
    try {
      const data = await fetchJson(`${host}/api/v1/search?${params}`);
      sendJson(res, 200, data);
      return;
    } catch (error) {
      errors.push(`${host}: ${error.message}`);
    }
  }

  sendJson(res, 502, { error: 'All search providers failed', providers: errors });
}

async function proxySuggest(url, res) {
  const query = (url.searchParams.get('q') || '').trim();
  if (!query) {
    sendJson(res, 400, { error: 'Missing q parameter' });
    return;
  }

  const api = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
  const data = await fetchJson(api);
  sendJson(res, 200, data);
}

async function proxyMusic(url, res) {
  const query = (url.searchParams.get('q') || '').trim();
  if (!query) {
    sendJson(res, 400, { error: 'Missing q parameter' });
    return;
  }

  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 20;
  const params = new URLSearchParams({
    term: query,
    media: 'music',
    entity: 'song',
    limit: String(limit),
    offset: String((page - 1) * limit)
  });

  const data = await fetchJson(`https://itunes.apple.com/search?${params}`);
  sendJson(res, 200, mapItunesResults(data.results || []));
}

function mapItunesResults(results) {
  return results
    .filter(item => item.previewUrl)
    .map(item => ({
      type: 'audio',
      audioUrl: item.previewUrl,
      title: item.trackName,
      author: item.artistName,
      lengthSeconds: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 30,
      viewCountText: item.collectionName || 'Preview',
      videoThumbnails: [{
        quality: 'medium',
        url: String(item.artworkUrl100 || '').replace('100x100bb', '600x600bb')
      }]
    }));
}

async function serveStatic(pathname, res) {
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const decoded = decodeURIComponent(cleanPath);
  const filePath = path.resolve(root, `.${decoded}`);
  const relative = path.relative(root, filePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    const type = contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-store'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'accept': 'application/json',
        'user-agent': 'AirBeatsLocal/1.0'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(data));
}
