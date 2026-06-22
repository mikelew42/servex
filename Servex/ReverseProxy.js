import http from 'http';
import httpProxy from 'http-proxy';

export default class ReverseProxy {
  constructor(ports) {
    this.ports = ports;
    this.proxy = httpProxy.createProxyServer({});
    this.server = http.createServer(this.handle.bind(this));
    this.server.on('upgrade', this.handleWs.bind(this));
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

  handleWs(req, socket, head) {
    const target = this.target(req);
    if (!target) return socket.destroy();
    this.proxy.ws(req, socket, head, { target });
  }
}
