# Servex MVP Plan

---

## Repo Setup

Fork `framework-site` — it already has:
- `Server/` submodule (Server.js + plugins)
- `public/` with the front-end View system
- `server.js` entry point pattern

Rename/repurpose into `servex/`:

```
servex/
  Server/            ← git submodule (unchanged)
  public/            ← Servex dashboard UI (HTML, CSS, client JS)
  Servex.js          ← main Servex class
  index.js           ← imports Servex, creates new Servex()
  package.json
```

Run with: `node index.js` (or `npm start`)

---

## Single Process vs. Separate

**Keep it one process.** The `Servex` class owns everything:

- Reverse proxy (port 80, `*.localhost` routing)
- Port registry (find, assign, persist port mappings)
- pm2 bridge (start/stop/restart project servers)
- Dashboard server (`servex.dashboard` — a `Server` instance for static hosting + WS)

`Servex.dashboard` is just a `new Server()` instance that serves `public/` and handles the dashboard WebSocket. Same `Server` class used by all projects — Servex eats its own cooking.

```js
// Servex.js (rough sketch)
class Servex {
  constructor() {
    this.dashboard = new Server({ port: this.getPort('servex') })
    this.dashboard.use(DevSocket)
    this.proxy = new ReverseProxy()   // port 80, *.localhost → port map
    this.ports = new PortRegistry()   // load/save port assignments
  }
}

// index.js
const servex = new Servex()
```

---

## MVP Steps

### Step 1 — Repo & Skeleton
- [ ] Fork `framework-site` → `servex`
- [ ] Strip out site-specific content, keep `Server/` submodule and `public/` View system
- [ ] Create `Servex.js` with empty class stub
- [ ] Create `index.js` → `new Servex()`
- [ ] `package.json` with `"start": "node index.js"` and `"bin": "index.js"` for future CLI
- [ ] Confirm `node index.js` boots without errors

### Step 2 — Dashboard Server
- [ ] `Servex` instantiates `this.dashboard = new Server({ port: 3000 })`
- [ ] `Server` serves `public/` statically
- [ ] Dashboard accessible at `localhost:3000`
- [ ] Basic `index.html` in `public/` — just a heading, confirms it's running
- [ ] Confirm `http://localhost:3000` works

### Step 3 — Reverse Proxy
- [ ] Install `http-proxy` (or hand-roll with Node `http`)
- [ ] `ReverseProxy` class listens on port 80
- [ ] Reads `Host` header, strips `.localhost`, looks up port in registry
- [ ] Forwards HTTP + WebSocket upgrade headers
- [ ] `servex.localhost` → port 3000 (the dashboard itself) — first mapping
- [ ] Confirm `http://servex.localhost` reaches the dashboard in Chrome

### Step 4 — Port Registry
- [ ] `PortRegistry` class — loads/saves a JSON file (`~/.servex/ports.json` or `servex.ports.json`)
- [ ] `getPort(name)` → returns existing port if known, else assigns a random unused one and persists it
- [ ] `Servex` uses this for its own dashboard port and all managed projects
- [ ] Confirm port survives restarts (cookies/sessions stay stable)

### Step 5 — Dashboard WebSocket
- [ ] `Server.use(DevSocket)` on `this.dashboard`
- [ ] DevSocket handles the control plane: receive commands, send status updates
- [ ] Dashboard UI connects to `ws://servex.localhost`
- [ ] Confirm WS connection established, basic ping/pong works

### Step 6 — Project List UI
- [ ] `Servex.load(path)` — scans a directory, detects `package.json`, git repo
- [ ] Returns a project object: `{ name, path, port, scripts, status }`
- [ ] Dashboard UI renders a list of loaded projects
- [ ] Each project shows: name, URL (`name.localhost`), status (stopped), available scripts as buttons
- [ ] Hardcode a test project path for now

### Step 7 — Start/Stop a Project
- [ ] `Servex.Server` class wraps pm2 programmatic API
- [ ] `project.start()` → `pm2.connect()` → `pm2.start({ script, cwd, name, env })`
- [ ] `project.stop()` → `pm2.stop(name)`
- [ ] pm2 bus events feed status back to dashboard via DevSocket (green/red indicator)
- [ ] Dashboard "start" button triggers this flow end-to-end
- [ ] Confirm a real project (`framework-site`) starts and is accessible at `project.localhost`

---

## What's Deliberately Deferred

- File explorer / code editor
- Git UI
- DevSocket in managed projects (test streaming, log streaming)
- MCP integration
- npm/GitHub browsing
- Staging / CF container integration
- `--inspect` / debugger integration
- Configurable panel system

---

## Port 80 Privilege Note

On Mac/Linux, port 80 requires elevated permissions. For MVP dev:
- Run `sudo node index.js` temporarily
- Or use `authbind` (Linux) / `launchd` plist (Mac) to allow port 80 without sudo
- Document this; solve it properly before any public release