import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'servex.ports.json');
const START_PORT = 3000;

export default class PortRegistry {
  constructor() {
    this.ports = this.load();
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
      return {};
    }
  }

  save() {
    fs.writeFileSync(FILE, JSON.stringify(this.ports, null, 2));
  }

  get_port(name) {
    if (this.ports[name]) return this.ports[name];
    const used = new Set(Object.values(this.ports));
    let port = START_PORT;
    while (used.has(port)) port++;
    this.ports[name] = port;
    this.save();
    return port;
  }
}
