# Servex

@servex-mvp.md

For broader vision, see servex.md.

## Project Overview

**Servex** is a full-stack web application built with Node.js and a custom framework. It uses Express for the HTTP server, WebSockets for real-time communication, and custom Server/App frameworks managed as git submodules.

## Architecture

### Server-Side (`server.js`)
- Entry point that initializes a custom `Server` framework (git submodule)
- Uses the `SocketServer` plugin to enable WebSocket communication via the `ws` library
- Includes a `LiveReload` plugin for development (file watching via `chokidar`)
- The actual Server implementation is in the `Server/` submodule (https://github.com/mikelew42/Server.git)

### Client-Side (`public/`)
- `index.html`: HTML entry point that loads `app.js` as a module
- `app.js`: Exports an `App` instance from the custom framework in `public/framework/` submodule
- `page.js`: Example page component
- `assets/`: Static assets (images, etc.)
- Uses custom UI framework from `public/framework/` submodule (https://github.com/mikelew42/framework.git)

### Key Dependencies
- **express**: HTTP server framework
- **ws**: WebSocket implementation
- **chokidar**: File watcher for development/live reload

## Development Setup

### Initialize Submodules
The Server and App framework are git submodules. To set up the full project:

```bash
git submodule update --init --recursive
npm install
```

### Running the Server

```bash
node server.js
```

The server will start and listen on a port determined by the Server framework configuration (typically 3000 or 3001).

## Code Patterns

- **ES Modules**: Project uses `"type": "module"` in package.json, so all JavaScript uses ESM syntax (`import`/`export`)
- **Custom Frameworks**: Both Server and App are custom frameworks in submodules. Familiarity with these submodules' APIs is necessary for development
- **LiveReload**: The LiveReload plugin watches for file changes during development and notifies clients via WebSocket

## Common Tasks

- **Starting development**: `git submodule update --init --recursive && npm install && node server.js`
- **Adding a new page**: Create a new JS file in `public/` that uses the App framework API
- **Server configuration**: The Server framework behavior is in the `Server/` submodule
