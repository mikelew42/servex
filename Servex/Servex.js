import fs from 'fs';
import path from 'path';
import pm2 from 'pm2';
import Server from '../Server/Server.js';
import DevSocket from '../Server/plugins/DevSocket/DevSocket.js';
import ReverseProxy from './ReverseProxy.js';
import PortRegistry from './PortRegistry.js';
import Project from './Project.js';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

class Dashboard extends Server {
  listen(port, host) {
    super.listen(port ?? this.port ?? 3000, host);
  }
}

Dashboard.use(DevSocket);

function pm2_connect() {
  return new Promise((res, rej) => pm2.connect(err => err ? rej(err) : res()));
}

export default class Servex {
  constructor() {
    this.projects = [];
    this.ports = new PortRegistry();
    this.dashboard = new Dashboard({ port: this.ports.get_port('servex') });
    this.proxy = new ReverseProxy(this.ports.ports, name => this.auto_start(name));

    this.dashboard.router.get('/api/projects', (req, res) => {
      pm2.list((err, list) => {
        if (!err) this.sync_pm2(list);
        res.json(this.projects.map(p => p.toJSON()));
      });
    });

    this.dashboard.router.post('/api/projects/:name/start', async (req, res) => {
      const project = this.projects.find(p => p.name === req.params.name);
      if (!project) return res.status(404).json({ error: 'not found' });
      if (!project.start_config()) return res.status(400).json({ error: 'no start script' });
      try {
        await this.start(project);
        res.json({ status: project.status });
      } catch (err) {
        console.error('start error', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.dashboard.router.post('/api/projects/:name/stop', async (req, res) => {
      const project = this.projects.find(p => p.name === req.params.name);
      if (!project) return res.status(404).json({ error: 'not found' });
      try {
        await new Promise((resolve, reject) =>
          pm2.stop(project.name, err => err ? reject(err) : resolve())
        );
        project.status = 'stopped';
        this.broadcast('projectStatus', project.name, project.status);
        res.json({ status: project.status });
      } catch (err) {
        console.error('stop error', err);
        res.status(500).json({ error: err.message });
      }
    });

    this.load('C:/Code');

    // Push current state to each new socket connection
    this.dashboard.socket_server.wss.on('connection', () => {
      const socket = this.dashboard.socket_server.sockets.at(-1);
      if (!socket) return;
      for (const p of this.projects) {
        if (p.status !== 'stopped') socket.rpc('projectStatus', p.name, p.status);
      }
    });

    this.init_pm2();
  }

  async init_pm2() {
    await pm2_connect();

    pm2.list((err, list) => {
      if (err) return console.error('pm2 list error', err);
      this.sync_pm2(list, true);
    });

    pm2.launchBus((err, bus) => {
      if (err) return console.error('pm2 bus error', err);
      bus.on('process:event', (data) => {
        const project = this.projects.find(p => p.name === data.process.name);
        if (!project) return;
        const map = { online: 'online', stop: 'stopped', exit: 'stopped', restart: 'launching', errored: 'errored' };
        project.status = map[data.event] || data.event;
        this.broadcast('projectStatus', project.name, project.status);
      });
    });
  }

  sync_pm2(list, broadcast = false) {
    for (const proc of list) {
      const project = this.projects.find(p => p.name === proc.name);
      if (!project) continue;
      const status = proc.pm2_env.status === 'online' ? 'online' : 'stopped';
      if (project.status !== status) {
        project.status = status;
        if (broadcast) this.broadcast('projectStatus', project.name, project.status);
      }
    }
  }

  async start(project) {
    await new Promise((resolve, reject) =>
      pm2.start({ ...project.start_config(npm), env: { PORT: String(project.port) } }, err => err ? reject(err) : resolve())
    );
  }

  auto_start(name) {
    const project = this.projects.find(p => p.name === name);
    if (!project || !project.start_config()) return false;
    if (project.status === 'launching') return true;
    project.status = 'launching';
    this.broadcast('projectStatus', project.name, project.status);
    this.start(project).catch(err => {
      console.error('auto-start error:', err.message);
      project.status = 'stopped';
      this.broadcast('projectStatus', project.name, project.status);
    });
    return true;
  }

  broadcast(method, ...args) {
    for (const socket of this.dashboard.socket_server?.sockets || []) {
      socket.rpc(method, ...args);
    }
  }

  load(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) this.load_repo(path.join(dir, entry.name));
    }
  }

  load_repo(dir) {
    if (!fs.existsSync(path.join(dir, 'package.json'))) return;
    const name = path.basename(dir);
    const project = new Project(dir, this.ports.get_port(name));
    this.projects.push(project);
    this.proxy.ports[project.name] = project.port;
    return project;
  }
}
