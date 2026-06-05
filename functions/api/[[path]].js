// Cloudflare Pages Function — proxies all /api/* requests to moontv upstream
// PLUS: Auth & per-user cloud data sync via KV (TREEHOLE_DB)

const UPSTREAM = 'https://moontv.022340618.xyz';
const USERNAME = 'sond';
const PASSWORD = '123456';

// Module-scope session (persists across requests within the same isolate)
let sessionCookie = null;
let sessionExpiry = 0;

// ====== JWT Utilities (Web Crypto, no deps) ======
const encoder = new TextEncoder();

function b64url(b) {
  const s = typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urld(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function signJWT(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = b64urld(parts[2]);
    const ok = await crypto.subtle.verify('HMAC', key, sig,
      encoder.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urld(parts[1])));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload; // { sub: userId, iat, exp }
  } catch { return null; }
}

// ====== Password Hashing (PBKDF2) ======
async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pw),
    'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256);
  return b64url(bits);
}

function genSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return b64url(arr);
}

// ====== KV Helpers ======
async function getUserData(kv, userId) {
  try {
    const raw = await kv.get(`user:${userId}:data`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveUserData(kv, userId, data) {
  const json = JSON.stringify(data);
  // Warn if approaching KV 25MB limit (but don't block)
  if (json.length > 22 * 1024 * 1024) {
    console.warn(`[DATA] User ${userId} data is ${(json.length/1024/1024).toFixed(1)}MB — close to KV limit`);
  }
  await kv.put(`user:${userId}:data`, json);
}

// ====== Moontv Session ======
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
        const match = sc.match(/([^;,]+=[^;,]+)/);
        sessionCookie = match ? match[1] : sc.split(';')[0];
        sessionExpiry = Date.now() + 25 * 60 * 1000;
      }
      await resp.text();
    }
    return resp.ok;
  } catch (e) {
    console.error('Login failed:', e.message);
    return false;
  }
}

async function proxyFetch(url, opts = {}, retryLogin = true) {
  const headers = new Headers(opts.headers || {});
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  if (sessionCookie) headers.set('Cookie', sessionCookie);

  let resp = await fetch(url, { ...opts, headers });
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

async function cdnFetch(cdnUrl) {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  let cdnOrigin = '';
  try { cdnOrigin = new URL(cdnUrl).origin; } catch (_) {}

  const refererStrategies = [
    cdnOrigin ? cdnOrigin + '/' : null,
    UPSTREAM + '/',
    'https://treehole.022340618.xyz/',
    '',
  ].filter(r => r !== null);

  let lastStatus = 0;
  for (const referer of refererStrategies) {
    const headers = new Headers();
    headers.set('User-Agent', ua);
    headers.set('Accept', '*/*');
    if (referer) headers.set('Referer', referer);
    try {
      const resp = await fetch(cdnUrl, { headers, redirect: 'follow' });
      if (resp.ok) return resp;
      lastStatus = resp.status;
      try { await resp.body?.cancel(); } catch (_) {}
    } catch (e) {
      console.log('[cdnFetch] Referer=' + (referer || '(none)') + ' => error: ' + e.message);
    }
  }
  return new Response(null, { status: 502 });
}

// ====== CORS ======
function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    ...extra,
  };
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
  });
}

// ====== Main Handler ======
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const kv = env.TREEHOLE_DB;
  const jwtSecret = env.JWT_SECRET || 'treehole-default-secret-change-me';

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // ────── AUTH ROUTES (no moontv session needed) ──────

  // POST /api/auth/register
  if (path === '/api/auth/register' && request.method === 'POST') {
    if (!kv) return jsonResp({ error: 'KV not configured' }, 500);
    try {
      const { username, password } = await request.json();
      if (!username || !password) return jsonResp({ error: 'Username and password required' }, 400);
      if (username.length < 2 || username.length > 30) return jsonResp({ error: 'Username must be 2-30 characters' }, 400);
      if (password.length < 4) return jsonResp({ error: 'Password must be at least 4 characters' }, 400);

      // Check if username exists (case-insensitive)
      const lowerUser = username.toLowerCase().trim();
      const existing = await kv.get(`user:${lowerUser}:creds`);
      if (existing) return jsonResp({ error: 'Username already taken' }, 409);

      // Create user
      const salt = genSalt();
      const hash = await hashPw(password, salt);
      const creds = { username: lowerUser, salt, hash, createdAt: new Date().toISOString() };
      await kv.put(`user:${lowerUser}:creds`, JSON.stringify(creds));

      // Initialize empty data
      const initData = {
        movies: [],
        settings: { theme: 'ocean', paperMode: 'solid', apiConfig: null, proxyIps: [] },
        chats: { reviews: {}, standalone: [] },
        updatedAt: new Date().toISOString(),
      };
      await saveUserData(kv, lowerUser, initData);

      // Generate JWT
      const token = await signJWT({ sub: lowerUser, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 30 * 86400 }, jwtSecret);

      return jsonResp({ token, user: { username: lowerUser, createdAt: creds.createdAt }, data: initData });
    } catch (e) {
      return jsonResp({ error: 'Registration failed: ' + e.message }, 500);
    }
  }

  // POST /api/auth/login
  if (path === '/api/auth/login' && request.method === 'POST') {
    if (!kv) return jsonResp({ error: 'KV not configured' }, 500);
    try {
      const { username, password } = await request.json();
      if (!username || !password) return jsonResp({ error: 'Username and password required' }, 400);

      const lowerUser = username.toLowerCase().trim();
      const credsRaw = await kv.get(`user:${lowerUser}:creds`);
      if (!credsRaw) return jsonResp({ error: 'Account not found' }, 401);

      const creds = JSON.parse(credsRaw);
      const ok = await hashPw(password, creds.salt).then(h => h === creds.hash);
      if (!ok) return jsonResp({ error: 'Incorrect password' }, 401);

      // Generate JWT
      const token = await signJWT({ sub: lowerUser, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 30 * 86400 }, jwtSecret);

      // Load user data
      const userData = await getUserData(kv, lowerUser) || { movies: [], settings: {}, chats: {} };

      return jsonResp({ token, user: { username: lowerUser, createdAt: creds.createdAt }, data: userData });
    } catch (e) {
      return jsonResp({ error: 'Login failed: ' + e.message }, 500);
    }
  }

  // GET /api/auth/me — validate token and return user info
  if (path === '/api/auth/me' && request.method === 'GET') {
    if (!kv) return jsonResp({ error: 'KV not configured' }, 500);
    const authHdr = request.headers.get('Authorization');
    if (!authHdr || !authHdr.startsWith('Bearer ')) return jsonResp({ error: 'No token' }, 401);
    const token = authHdr.slice(7);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) return jsonResp({ error: 'Invalid or expired token' }, 401);

    const userId = payload.sub;
    const credsRaw = await kv.get(`user:${userId}:creds`);
    if (!credsRaw) return jsonResp({ error: 'Account deleted' }, 401);
    const creds = JSON.parse(credsRaw);

    const userData = await getUserData(kv, userId) || { movies: [], settings: {}, chats: {} };
    return jsonResp({ user: { username: userId, createdAt: creds.createdAt }, data: userData });
  }

  // ────── USER DATA ROUTES (auth required) ──────

  // Auth middleware for data routes
  async function requireAuth() {
    if (!kv) return null;
    const authHdr = request.headers.get('Authorization');
    if (!authHdr || !authHdr.startsWith('Bearer ')) return null;
    const token = authHdr.slice(7);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) return null;
    const exists = await kv.get(`user:${payload.sub}:creds`);
    return exists ? payload.sub : null;
  }

  // GET /api/user/data — get all user data
  if (path === '/api/user/data' && request.method === 'GET') {
    const userId = await requireAuth();
    if (!userId) return jsonResp({ error: 'Authentication required' }, 401);
    const data = await getUserData(kv, userId) || { movies: [], settings: {}, chats: {} };
    return jsonResp(data);
  }

  // PUT /api/user/data — save all user data
  if (path === '/api/user/data' && request.method === 'PUT') {
    const userId = await requireAuth();
    if (!userId) return jsonResp({ error: 'Authentication required' }, 401);
    try {
      const data = await request.json();
      if (typeof data !== 'object' || !Array.isArray(data.movies)) {
        return jsonResp({ error: 'Invalid data format. Expected { movies: [...], settings: {...}, chats: {...} }' }, 400);
      }
      data.updatedAt = new Date().toISOString();
      await saveUserData(kv, userId, data);
      return jsonResp({ ok: true, updatedAt: data.updatedAt });
    } catch (e) {
      return jsonResp({ error: 'Save failed: ' + e.message }, 500);
    }
  }

  // GET /api/user/settings — get settings only (lightweight)
  if (path === '/api/user/settings' && request.method === 'GET') {
    const userId = await requireAuth();
    if (!userId) return jsonResp({ error: 'Authentication required' }, 401);
    const data = await getUserData(kv, userId);
    return jsonResp(data?.settings || {});
  }

  // PUT /api/user/settings — save settings only (lightweight, merge)
  if (path === '/api/user/settings' && request.method === 'PUT') {
    const userId = await requireAuth();
    if (!userId) return jsonResp({ error: 'Authentication required' }, 401);
    try {
      const newSettings = await request.json();
      const data = await getUserData(kv, userId) || { movies: [], settings: {}, chats: {} };
      data.settings = { ...data.settings, ...newSettings };
      data.updatedAt = new Date().toISOString();
      await saveUserData(kv, userId, data);
      return jsonResp({ ok: true, settings: data.settings });
    } catch (e) {
      return jsonResp({ error: 'Save failed: ' + e.message }, 500);
    }
  }

  // ────── MOONTV PROXY ROUTES (unchanged) ──────

  // Ensure logged in before handling moontv requests
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

      const workerBase = `${url.protocol}//${url.host}`;
      const baseUrl = tgt.replace(/\/[^/]+$/, '/');
      const lines = m3u8Text.split('\n');
      const rewritten = lines.map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || trimmed.length === 0) return line;
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
