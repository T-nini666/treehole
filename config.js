const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const PROXY_URL = isLocal
  ? 'ws://127.0.0.1:7890'
  : 'wss://your-cloudflare-worker.workers.dev';
