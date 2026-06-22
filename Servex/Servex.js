import Server from '../Server/Server.js';
import DevSocket from '../Server/plugins/DevSocket/DevSocket.js';
import ReverseProxy from './ReverseProxy.js';
import PortRegistry from './PortRegistry.js';

class Dashboard extends Server {
  listen(port, host) {
    super.listen(port ?? this.port ?? 3000, host);
  }
}

Dashboard.use(DevSocket);

export default class Servex {
  constructor() {
    this.ports = new PortRegistry();
    this.dashboard = new Dashboard({ port: this.ports.getPort('servex') });
    this.proxy = new ReverseProxy(this.ports.ports);
  }
}
