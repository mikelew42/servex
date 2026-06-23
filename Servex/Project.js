import fs from 'fs';
import path from 'path';

export default class Project {
  constructor(dir, port) {
    this.path = dir;
    this.port = port;
    this.status = 'stopped';

    const pkg = this.read_pkg();
    this.name = pkg.name || path.basename(dir);
    this.scripts = pkg.scripts ? Object.keys(pkg.scripts) : [];
  }

  read_pkg() {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.path, 'package.json'), 'utf8'));
    } catch {
      return {};
    }
  }

  start_config(npm = 'npm') {
    if (this.scripts.includes('start')) {
      return { script: npm, args: 'start', cwd: this.path, name: this.name };
    }
    for (const entry of ['server.js', 'index.js', 'app.js']) {
      if (fs.existsSync(path.join(this.path, entry))) {
        return { script: entry, cwd: this.path, name: this.name };
      }
    }
    return null;
  }

  get url() {
    return `http://${this.name}.localhost`;
  }

  toJSON() {
    return {
      name: this.name,
      path: this.path,
      port: this.port,
      scripts: this.scripts,
      status: this.status,
      url: this.url,
      can_start: !!this.start_config()
    };
  }
}
