# Servex

> "The servex is like the birth canal for servers."

A local development server manager with a browser-based dashboard. Handles starting/stopping projects, local hostname routing, real-time log/test streaming, and file system exploration.

---

## Repo & Distribution

Two viable approaches — not mutually exclusive:

**Option A: git submodule**
- `git submodule add <url> servex` — no npm registry needed
- Versioning via pinned commits per project
- No monorepo headaches, no publish step

**Option B: npm package (recommended for wider adoption)**
- Publish to npm with a `"bin": "cli.js"` entry in `package.json`
- `npm i -g servex` → global `servex` CLI, available anywhere on the machine
- `npx servex` → run without global install (npx checks local `node_modules/.bin` first, then downloads temporarily)
- `npm i --save-dev servex` → local install for projects that want a pinned version of the dev-socket API
- **Cannot auto-install a global CLI via `postinstall`** — npm blocks this for security and `--ignore-scripts` is common. Global install is always opt-in.

**Two roles for the npm package:**
- **Dashboard process** (global/npx): one instance per machine, runs the dashboard + reverse proxy. Always one version.
- **Dev-socket library** (local devDependency): the bit a project's server imports to stream logs/tests back to the dashboard. Each project can pin its own version independently — that's fine, they're just library consumers.

**Multiple dashboard versions:** not really viable. The dashboard is a single running process; local `node_modules` copies of servex are just the library half, not the dashboard runner.

No bundler, no TypeScript, vanilla JS.

---

## Dashboard UI

- Core of the dashboard is a **left sidebar file explorer** — drag and drop, copy/paste, multi-folder support
- You can open any directory; multiple root folders can coexist
- **Configurable panel/pane system** (TBD — just note it exists; layout, splits, etc. all configurable)
- The dashboard is highly configurable overall

---

## Project Detection & Setup

- Add any existing directory; Servex scans and auto-detects project type
- Basic detection via `package.json` (scripts: `start`, `dev`, `build`, etc.)
- Detected scripts surface as **buttons** in the dashboard (e.g. a "dev" button, a "build" button)
- Projects can include a `servex.config.js` or similar to nudge detection in the right direction
- Detects git repos as first-class entities — Servex is mostly path-based; repos are just directories with metadata
- Project config can grow per-project (ports, watchers, env vars, restart policy, etc.)

---

## Local Hostname Routing

- Servex runs a **reverse proxy** that intercepts `*.localhost` requests, reads the `Host` header, and forwards to `localhost:<port>`
- No DNS config, no hosts file edits, no sudo — Chrome and Firefox resolve `*.localhost` to `127.0.0.1` natively
- Project name defaults to repo folder name: `my-app-v2` → `my-app-v2.localhost`
- Ports are assigned on first launch and **persisted** (cookies, sessions stay stable)
- Reverse proxy needs **port 80** for clean URLs — may need privilege handling: `authbind` (Linux), `launchd` (Mac)
- Caveat: browser-only resolution — won't work in `curl` etc. Acceptable for this use case
- Fallback if system-wide needed: `dnsmasq` + `.test` TLD. Avoid `.local` (Bonjour) and `.dev` (real TLD)

### Subdomain Conventions

Each project gets a namespace under its name:

- `servex.localhost` — the Servex dashboard itself
- `project.localhost` — the project app
- `dev.project.localhost` — the project's dev dashboard / admin drawer

Optional extensions for multi-process projects (TBD):
- `api.project.localhost`
- `db.project.localhost`

### HTTP + WebSocket on the Same Endpoint

WebSocket starts as an HTTP request and upgrades via the `Upgrade: websocket` header — so HTTP and WS share the same port and domain with no extra config. `dev.project.localhost` handles both `http://` and `ws://`. The reverse proxy just needs to forward upgrade headers, which Node's `http-proxy` does automatically.

---

## Child Process Management (`Servex.Server`)

Rather than rolling a custom process manager, **Servex wraps pm2** programmatically:

- pm2 has a clean programmatic API: `pm2.connect()`, `pm2.start()`, `pm2.stop()`, `pm2.restart()`
- `pm2.launchBus()` emits realtime events: `log:out`, `log:err`, crashes, restarts — exactly what Servex needs to stream to the dashboard
- File watching, crash recovery, auto-restart, env var injection, memory limits — all free from pm2
- `Servex.Server` is a thin OO wrapper around pm2 calls, not a reimplementation

**Layering:**
- pm2 keeps the **Servex process itself** alive (run once, stays up forever, survives crashes)
- Servex uses pm2 internally to manage each **project server**
- In prod, `servex start` replaces `pm2 start` — you get process management + dev-socket + dashboard visibility in one command

**pm2 daemon caveat:** pm2 runs its own background daemon. `pm2.connect()` attaches to it (or spawns it). The daemon outlives the Servex process — good for prod resilience, but pm2 becomes a real system dependency, not just a library.

**Realtime status in dashboard:** green = online, red = errored/crashed, yellow = launching/restarting — fed directly from pm2 bus events.

---

## Socket Topology

Three distinct socket connections form the communication backbone:

```
[servex.localhost dashboard]
        |
        |-- WebSocket --> [Servex Node process]  (control plane: start, stop, load, config)
        |
        |-- WebSocket --> [project dev-socket]   (per-project: logs, tests, status)
        |-- WebSocket --> [project dev-socket]
        |-- ...

[Servex Node process]
        |
        |-- pm2 --> [project server]
        |               |
        |               └-- dev-socket (project's own WS server)
        |
        |-- pm2 --> [project server]
        |-- ...
```

- **`servex.localhost` dashboard** connects to the Servex Node process for control, and *also* directly to each project's `dev-socket` for realtime data
- **Servex Node process** manages processes via pm2, taps pm2 bus for events, relays to dashboard
- **`dev-socket`** is a per-project WebSocket server — streams logs, test results, process status
- Simple static sites can have a minimal `dev-socket` added via a small admin drawer/overlay

---

## `Servex` API (sketch — method names only)

OO-first: `servex.start(id)` is shorthand for `servex.get(id).start()`.

```js
class Servex {
  load(path)               // open a directory, scan for repos/projects
  scan(path)               // detect project type, scripts, git status
  unload(path)

  open(path)               // open in file explorer
  watch(path)              // add fs watcher

  get(id)                  // returns a Servex.Server instance
  getAll()

  install(id)              // run npm install or equivalent
  run(id, script)          // run arbitrary package.json script

  on(event, cb)            // realtime events: crash, restart, log, test, etc.
}

class Servex.Server {
  start()
  stop()
  restart()
  kill()

  setPort(port)
  setEnv(key, value)

  getStatus()              // online | stopped | errored | launching
  getPid()
  getPort()
  getLogs()

  send(msg)                // IPC to child (fork() only; dev-socket otherwise)
  on(event, cb)            // crash, restart, stdout, stderr, test, log
}
```

---

## Per-Project `dev-socket`

Each project repo, if it has a server, should expose its own `dev-socket`:

- A lightweight WebSocket server built into the project
- Streams: test runs + results, `log()` output, process status, errors
- The Servex dashboard connects to it directly for realtime updates
- For simple/static projects: a minimal **admin drawer** overlay that gives basic access to server info and can launch the full dev dashboard
- From the dev-socket/dashboard you can:
  - View test results
  - Launch `--inspect` tabs for specific tests or subtests
  - Step through code in CDT while rendered logs appear in the Servex dashboard side-by-side

---

## Log & Test Streaming

- Test runs and results stream as they execute (not just at end)
- `log()` streams in real time to the dashboard
- Visual, rich output — the more visual the better
- `log()` noopable for production (env flag)
- See `test-runner.md` for the test API

---

## Debugger Integration & DOM Access

- Servers launched with `--inspect` → connect Chrome DevTools for stepping
- **Node has no DOM** — `--inspect` only exposes V8 (Console, Sources, Profiler). No `document`, no `window`
- Options for server-side DOM:
  - **WebSocket streaming (default)** — Node streams to dashboard; dashboard renders. Clean, no coupling
  - **jsdom** — real `document.createElement()` in Node, no visual rendering; good for logic/structural tests
  - **Puppeteer** — Node drives real Chrome; heavy, power-user future feature
- Dual view: Chrome DevTools for stepping, Servex dashboard for runtime state/output

---

## MCP (Model Context Protocol) Integration

Servex can expose itself as an **MCP server**, making it an agentic API for AI tools.

**MCP transport:** two official standards — `stdio` (local process, stdin/stdout, best for Claude Code and local AI tools) and Streamable HTTP (HTTP POST + optional SSE, best for remote/browser clients). WebSocket is not yet in the spec but custom transports are allowed. Servex's existing `dev-socket` is separate from MCP — MCP sits alongside it as a control interface.

**Servex as MCP server:**
- AI tools (Claude Code, etc.) can `start`/`stop` projects, open browsers, run commands via MCP
- Local AI runners like Claude Code don't need MCP for most commands, but MCP is the right way to start a server so it registers in the `servex.localhost` dashboard
- `stdio` transport is ideal here — Claude Code spawns Servex as a subprocess

**Per-project MCP servers:**
- Each project server could expose its own MCP endpoint
- Exposes: all API routes/endpoints, config, paths, data schemas
- AIs can inspect, query, and manage the project directly
- Natural fit at `dev.project.localhost/mcp` alongside the dev-socket

---

## Code Editor & Git UI

The file explorer naturally wants to grow into a full dev environment:

- **Code editor(s)** — embedded in the dashboard, approaching VS Code territory
- **Git UI** — stage, commit, diff, branch, push/pull
- The `dev-socket` can expose **filesystem APIs** (read/write) so editors work remotely too

**Avoiding duplication between `servex.localhost` and `dev.project.localhost`:**
- The UI components (`FileExplorer`, `CodeEditor`, `GitPanel`, `TestRunner`) are a **shared library**
- `servex.localhost` is the full IDE-like host — all panels, all projects
- `admin.project.localhost` (or `dev.project.localhost`) is a **lightweight embed** of the same components, scoped to that project
- Same code, two shells — no duplication

---

## Environment Progression: Local → Staging → Prod

The dev-socket and admin drawer should exist on a spectrum, not be binary on/off:

```
local:    project.localhost        full capabilities
          dev.project.localhost    full dev dashboard, editor, git, tests, logs

staging:  project.staging.example.com          app only
          dev.staging.example.com (optional)   limited dashboard — read-only logs,
                                               test runs, maybe settings tweaks

prod:     project.example.com     app only, no dev-socket at all
```

**Capability mask per environment** — one UI, features enabled/disabled by env:

| Feature            | local | staging | prod |
|--------------------|-------|---------|------|
| File read          | ✅    | maybe   | ❌   |
| File write         | ✅    | ❌      | ❌   |
| Git commit/push    | ✅    | ❌      | ❌   |
| Test runner        | ✅    | ✅      | ❌   |
| Log streaming      | ✅    | ✅      | ❌   |
| Config/settings    | ✅    | maybe   | ❌   |
| --inspect          | ✅    | ❌      | ❌   |

**Graceful failure for static sites (e.g. Cloudflare Pages):**
- The dev-socket simply doesn't exist in the deployed build
- Client-side code attempts `ws://dev.project.localhost` → fails silently
- Show a small disconnected indicator, nothing breaks
- Controlled by env check: `if (NODE_ENV !== 'production')` wraps socket init, or better, a `SERVEX_MODE` env var so you can have prod builds with optional monitoring
- For Cloudflare/static: the dev dashboard JS is excluded from the prod bundle entirely (or conditionally loaded)

**In-place editing on staging** — the vision:
- When doing QA on staging and hitting a snag, the fastest fix is: open the dev drawer *on that page*, find the file, edit it, push — done
- vs. the alternative: find the repo locally, navigate to the right file, remember what you were looking at, fix, push, wait for deploy, re-QA
- Dev drawer works two ways: open as a new tab (`dev.staging.project.com`) or as an **in-page overlay** injected into the staging page — same UI, same socket, just mounted differently
- Auth-gated — staging dev-socket should require a token or be IP-restricted; it's a root-level file editor on a live server

**Cloudflare deployment:**
- Static assets are deployed via `wrangler pages deploy <directory>` — a single CLI call, no build step required
- "Publish" from the dev drawer just shells out to wrangler — instant redeploy of changed assets
- For assets that don't need a build step, this can bypass GitHub Actions entirely and go straight to CF edge

**CF Container as the staging dev server:**
- A **Cloudflare Container** is the right host for staging dev-socket — not a DO (which can't run git), not a plain static deploy
- CF containers support **FUSE filesystem mounting**:
  - **ArtifactFS** (just open-sourced by CF): mounts a git repo as a local filesystem inside a container, hydrating file contents on-the-fly — "git clone but async." Designed for agents/sandboxes/containers. Supports `git commit`, `git push` to GitHub
  - **R2 FUSE** (tigrisfs): mount an R2 bucket as a filesystem for static asset storage
- Full in-place edit flow on CF:
  ```
  dev drawer → dev-socket (CF Container)
                   ↓ ArtifactFS (git repo mounted as local FS)
                edit file in CodeEditor
                   ↓ git commit + push → GitHub
                   ↓ wrangler pages deploy (or GH Action triggers it)
                CF edge serves updated assets
  ```
- **Bypass rebuild option**: for no-build-step assets (plain HTML/CSS/JS), wrangler deploys directly from the container — no GitHub round-trip needed. Commit to git happens in the background or after confirmation
- Cloudflare/static-only deploys without a container: drawer shows "read-only — no dev server detected"

---

## Current Project Structure (framework-site)

```
framework-site/
  Server/          ← git submodule (Server.js + plugins)
    Server.js
    ServerSocket.js
    LiveReload.js
    <other plugins>
  server.js        ← imports Server.js, creates new Server()
  package.json
```

Run with: `node server.js`

The `Server` uses a plugin system: `Server.use(ServerSocket)`, and `ServerSocket` currently includes `LiveReload`. Client socket connects to the root domain as its endpoint.

---

## npm Scripts & package.json Convention

**Best practice for running the server:**

```json
{
  "scripts": {
    "start": "node server.js",
    "dev":   "node server.js --dev"
  }
}
```

- `npm start` → standard; what Servex detects and surfaces as a button
- `npm run dev` → optional dev-mode flag (enables DevSocket, etc.)
- `npx servex` → starts Servex dashboard itself (separate from project server)
- Servex auto-detects `package.json` scripts and surfaces them as buttons in the dashboard

**`package.json` as config:** yes, lean into it. A `"servex"` key in `package.json` can hold project-level Servex config — port hints, socket mode, script overrides — without needing a separate `servex.config.js`. Both options are valid; `package.json` is lower friction for simple cases.

```json
{
  "scripts": { "start": "node server.js" },
  "servex": {
    "port": 3000,
    "dev_socket": true,
    "name": "framework-site"
  }
}
```

---

## DevSocket (splitting dev from prod socket)

**Current:** `Server.use(ServerSocket)` — one socket, handles everything including LiveReload. Client connects to root domain.

**Proposed split:**

```js
// server.js
Server.use(ServerSocket)                      // prod socket (optional, app-specific)
if (config.use_dev_socket) Server.use(DevSocket)  // dev socket (all dev tooling)
```

- `DevSocket` absorbs everything dev-specific: LiveReload, logging, debugging, file system reads/writes, test streaming, `--inspect` integration
- `ServerSocket` stays lean — only what's needed for the app in prod
- Both can run simultaneously with no conflict (separate WS paths/namespaces)
- Client connects to `ws://dev.project.localhost` for DevSocket, root domain for ServerSocket
- `config.use_dev_socket` driven by env: `NODE_ENV !== 'production'` or explicit `SERVEX_DEV=true`

**What lives in DevSocket:**
- LiveReload / HMR
- `log()` streaming to Servex dashboard
- Test run streaming (results, pass/fail, timing)
- `--inspect` session coordination
- Filesystem API (read/write — for CodeEditor in dev drawer)
- File watcher events
- Git status / commit / push

**What stays in ServerSocket (if used):**
- App-specific real-time features (chat, notifications, data sync)
- Auth'd user sessions
- Anything that runs in prod

**Staging/prod behavior:**
- `use_dev_socket: false` → DevSocket never starts, client JS that tries to connect fails silently
- For CF containers on staging: `use_dev_socket: true`, DevSocket runs, drawer connects
- For pure static/CF Pages deploy: no server, no DevSocket, drawer shows "read-only"

---

## Vision: Servex as a Full Dev Platform

- **Package/repo browsing** — browse npm or GitHub, 1-click install or clone
- **Project scaffolding** — generate new projects from templates
- **Shareable setups** — export/import project configs, share across machines or collaborators
- **Unified dev hub** — all local projects, versions, ports, logs, test output in one place