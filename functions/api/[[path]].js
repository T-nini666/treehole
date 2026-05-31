// Cloudflare Pages Function — proxies all /api/* requests to moontv upstream
// Handles: search, detail, m3u8 (with URL rewrite), ts segments, proxy

const UPSTREAM = 'https://moontv.022340618.xyz';
const USERNAME = 'sond';
const PASSWORD = '123456';

// Module-scope session (persists across requests within the same isolate)
let sessionCookie = null;
let sessionExpiry = 0;

async function login() {
  try {
    const resp = await fetch(`${UPSTREAM}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    if (resp.ok) {
      const sc = resp.headers.get('set-cookie');
      if (sc) {
        // Extract the session cookie value (some servers return multiple cookies)
        const match = sc.match(/([^;,]+=[^;,]+)/);
        sessionCookie = match ? match[1] : sc.split(';')[0];
        sessionExpiry = Date.now() + 25 * 60 * 1000; // 25 min
      }
      await resp.text(); // consume body
    }
    return resp.ok;
  } catch (e) {
    console.error('Login failed:', e.message);
    return false;
  }
}

// Proxied fetch with auto-relogin on 401 (for moontv upstream API calls)
async function proxyFetch(url, opts = {}, retryLogin = true) {
  const headers = new Headers(opts.headers || {});
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  if (sessionCookie) {
    headers.set('Cookie', sessionCookie);
  }

  let resp = await fetch(url, { ...opts, headers });

  // Auto-relogin on 401
  if (resp.status === 401 && retryLogin) {
    console.log('Session expired, re-logging...');
    const ok = await login();
    if (ok) {
      const h2 = new Headers(opts.headers || {});
      h2.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      h2.set('Cookie', sessionCookie);
      resp = await fetch(url, { ...opts, headers: h2 });
    }
  }

  return resp;
}

// CDN fetch with Referer header (for m3u8/segment — many CDNs require Referer)
async function cdnFetch(cdnUrl) {
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // Set Referer to CDN origin — many video CDNs enforce hotlinking protection
  try {
    const cdnOrigin = new URL(cdnUrl).origin;
    headers.set('Referer', cdnOrigin + '/');
  } catch (_) { /* ignore malformed URL */ }

  // Also try a secondary Referer: the moontv upstream (some CDNs whitelist the embedding site)
  // We send the CDN origin as primary; if 403, retry with moontv origin
  let resp = await fetch(cdnUrl, { headers, redirect: 'follow' });

  // Retry with different Referer if first attempt fails with 403/502
  if (!resp.ok && (resp.status === 403 || resp.status === 502 || resp.status === 404)) {
    console.log('[cdnFetch] First attempt failed (' + resp.status + '), retrying with moontv Referer...');
    try { await resp.body?.cancel(); } catch (_) { /* consume */ }
    const h2 = new Headers(headers);
    h2.set('Referer', UPSTREAM + '/');
    resp = await fetch(cdnUrl, { headers: h2, redirect: 'follow' });
  }

  return resp;
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    ...extra,
  };
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Ensure logged in before handling requests
  if (!sessionCookie || Date.now() > sessionExpiry) {
    await login();
  }

  try {
    // ─── /api/ping ───
    if (path === '/api/ping') {
      return new Response(
        JSON.stringify({ status: sessionCookie ? 'ok' : 'no_session', username: USERNAME, worker: true }),
        { headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }) }
      );
    }

    // ─── /api/search ───
    if (path === '/api/search') {
      const upstreamUrl = `${UPSTREAM}/api/search?${url.searchParams.toString()}`;
      console.log('[SEARCH]', upstreamUrl);
      const resp = await proxyFetch(upstreamUrl);
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
      });
    }

    // ─── /api/detail ───
    if (path === '/api/detail') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), {
          status: 400,
          headers: corsHeaders({ 'Content-Type': 'application/json' }),
        });
      }
      // Try multiple detail API paths (same as tv_proxy.ps1)
      const paths = [
        `/api/video?id=${encodeURIComponent(id)}`,
        `/api/vod/detail?id=${encodeURIComponent(id)}`,
        `/api/movie?id=${encodeURIComponent(id)}`,
        `/api/vod?id=${encodeURIComponent(id)}`,
      ];
      for (const p of paths) {
        const resp = await proxyFetch(`${UPSTREAM}${p}`, {}, false);
        if (resp.ok) {
          const text = await resp.text();
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            return new Response(text, {
              headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
            });
          }
        }
      }
      return new Response(JSON.stringify({ error: 'All detail API paths unavailable' }), {
        status: 502,
        headers: corsHeaders({ 'Content-Type': 'application/json' }),
      });
    }

    // ─── /api/proxy (generic) ───
    if (path === '/api/proxy') {
      let tgt = url.searchParams.get('url');
      if (!tgt) {
        const raw = url.search.slice(1);
        const m = raw.match(/^url=(.+)/);
        tgt = m ? decodeURIComponent(m[1]) : null;
      }
      if (!tgt) {
        return new Response(JSON.stringify({ error: 'Missing url' }), {
          status: 400,
          headers: corsHeaders({ 'Content-Type': 'application/json' }),
        });
      }
      const resp = await proxyFetch(tgt, {}, false);
      const body = resp.ok ? await resp.arrayBuffer() : null;
      return new Response(body, {
        status: resp.status,
        headers: corsHeaders({
          'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
        }),
      });
    }

    // ─── /api/m3u8 (HLS playlist + URL rewrite) ───
    if (path === '/api/m3u8') {
      let tgt = url.searchParams.get('url');
      if (!tgt) {
        const raw = url.search.slice(1);
        const m = raw.match(/^url=(.+)/);
        tgt = m ? decodeURIComponent(m[1]) : null;
      }
      if (!tgt) {
        return new Response(JSON.stringify({ error: 'Missing url' }), {
          status: 400,
          headers: corsHeaders(),
        });
      }

      const resp = await cdnFetch(tgt);
      if (!resp.ok) {
        return new Response(null, { status: 502, headers: corsHeaders() });
      }

      const m3u8Text = await resp.text();
      const isMaster = m3u8Text.includes('#EXT-X-STREAM-INF');

      // Compute the worker's own base URL for rewriting
      const workerBase = `${url.protocol}//${url.host}`;

      // Rewrite segment URLs to go through this worker
      const baseUrl = tgt.replace(/\/[^/]+$/, '/');
      const lines = m3u8Text.split('\n');
      const rewritten = lines.map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || trimmed.length === 0) {
          return line;
        }
        const segUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
        const encoded = encodeURIComponent(segUrl);
        if (isMaster) {
          return `${workerBase}/api/m3u8?url=${encoded}`;
        } else {
          return `${workerBase}/api/segment?url=${encoded}`;
        }
      });

      const out = rewritten.join('\n');
      return new Response(out, {
        headers: corsHeaders({
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'public, max-age=5',
        }),
      });
    }

    // ─── /api/segment (TS segment streaming) ───
    if (path === '/api/segment') {
      let tgt = url.searchParams.get('url');
      if (!tgt) {
        const raw = url.search.slice(1);
        const m = raw.match(/^url=(.+)/);
        tgt = m ? decodeURIComponent(m[1]) : null;
      }
      if (!tgt) {
        return new Response(null, { status: 400, headers: corsHeaders() });
      }

      const resp = await cdnFetch(tgt);
      if (!resp.ok) {
        return new Response(null, { status: 502, headers: corsHeaders() });
      }

      return new Response(resp.body, {
        headers: corsHeaders({
          'Content-Type': 'video/mp2t',
          'Cache-Control': 'public, max-age=3600',
        }),
      });
    }

    // ─── /api/cache-clear ───
    if (path === '/api/cache-clear') {
      return new Response(
        JSON.stringify({ status: 'cleared' }),
        { headers: corsHeaders({ 'Content-Type': 'application/json' }) }
      );
    }

    // ─── Unknown API route ───
    return new Response(
      JSON.stringify({ error: 'Unknown API route', path }),
      { status: 404, headers: corsHeaders({ 'Content-Type': 'application/json' }) }
    );

  } catch (e) {
    console.error('Worker error:', e.message);
    return new Response(
      JSON.stringify({ error: 'Internal error: ' + e.message.substring(0, 200) }),
      { status: 500, headers: corsHeaders({ 'Content-Type': 'application/json' }) }
    );
  }
}
