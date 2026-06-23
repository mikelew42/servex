import http from 'http';
import http_proxy from 'http-proxy';

const css = `
  body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #111; color: #ccc; }
  h1 { font-size: 1.4em; margin-bottom: 0.4em; }
  p { margin: 0.3em 0; font-size: 0.95em; color: #888; }
  a { color: #7c9cbf; }
`;

const starting_page = (name) => `<!doctype html>
<html><head><title>Starting ${name}...</title><style>${css}</style></head><body>
  <h1 style="color:#4ade80">Starting ${name}...</h1>
  <p>Hang tight.</p>
  <script>
    const poll = async () => {
      try {
        const r = await fetch(location.href, { cache: 'no-store' });
        if (!r.headers.get('x-servex-starting')) return location.reload();
      } catch {}
      setTimeout(poll, 800);
    };
    setTimeout(poll, 1200);
  </script>
</body></html>`;

const not_running_page = (host) => `<!doctype html>
<html><head><title>Not running</title><style>${css}</style></head><body>
  <h1 style="color:#f87171">${host} is not running</h1>
  <p><a href="http://servex.localhost">Start it from the Servex dashboard</a></p>
</body></html>`;

export default class ReverseProxy {
  constructor(ports, on_missing) {
    this.ports = ports;
    this.on_missing = on_missing;
    this.proxy = http_proxy.createProxyServer({});
    this.proxy.on('error', (err, req, res) => {
      console.error('proxy error:', err.message);
      if (!res?.writeHead) return;
      const host = (req.headers?.host || '').split(':')[0];
      const name = host.replace(/\.localhost$/, '');
      const starting = this.on_missing?.(name);
      if (starting) {
        res.writeHead(200, { 'Content-Type': 'text/html', 'X-Servex-Starting': '1' }).end(starting_page(name));
      } else {
        res.writeHead(502, { 'Content-Type': 'text/html' }).end(not_running_page(host));
      }
    });
    this.server = http.createServer(this.handle.bind(this));
    this.server.on('upgrade', this.handle_ws.bind(this));
    this.server.listen(80, () => console.log('ReverseProxy listening on port 80'));
  }

  target(req) {
    const host = (req.headers.host || '').split(':')[0];
    const name = host.replace(/\.localhost$/, '');
    const port = this.ports[name];
    return port ? `http://localhost:${port}` : null;
  }

  handle(req, res) {
    const target = this.target(req);
    if (!target) return res.writeHead(502).end(`No route for ${req.headers.host}`);
    this.proxy.web(req, res, { target });
  }

  handle_ws(req, socket, head) {
    const target = this.target(req);
    if (!target) return socket.destroy();
    this.proxy.ws(req, socket, head, { target });
  }
}
