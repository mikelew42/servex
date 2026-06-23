# FileSystem Brainstorm

## Current Behavior

`Servex.load(dir)` is a single-level scan:
1. `fs.readdirSync('C:/Code')` → every immediate subdirectory
2. For each: `load_repo(subdir)` → check for `package.json`, create `Project` if found, skip if not

Problems:
- No support for org/grouping folders within `C:/Code/`
- Repos nested inside org folders are silently skipped
- Every bare directory is probed for `package.json` (harmless but noisy)

---

## Goal

Support an arbitrary directory tree under `C:/Code/` where:
- Some subdirectories are **projects/repos** → become `Project` instances
- Others are **organizational folders** → just containers, recurse into them
- The system correctly identifies which is which

---

## Detection Heuristics

How to tell a repo from an org folder:

| Signal | Interpretation |
|--------|---------------|
| Has `.git/` | Definitely a repo |
| Has `package.json` | Likely a project (current check) |
| Has neither | Likely an org folder → recurse |
| Has `.servexignore` or `.noservex` file | Explicitly skip this dir |

Proposed logic for `scanDir(dir)`:
```
for each entry in dir:
  if entry has .git/ or package.json → treat as repo
  else if entry is a directory → recurse into it (as org folder)
  else → skip
```

Depth limit? Probably safe to recurse freely — org folders won't have `.git/` so they'll keep falling through. Could add a max depth (e.g., 3) as a safety net.

---

## FileSystem Class

Extract scanning into its own class, separate from `Servex`:

```js
// Servex/FileSystem.js
export default class FileSystem {
  constructor(root) {
    this.root = root;
    this.folders = [];  // { path, name, parent, children (Projects + sub-Folders) }
    this.projects = []; // flat list of all Project instances
  }

  scan() { ... }        // walk the tree, populate folders + projects
  isRepo(dir) { ... }   // .git/ or package.json check
}
```

`Servex` owns a `FileSystem` instance and calls `fs.projects` for its flat project list. `fs.folders` carries the tree shape for the UI.

---

## Folder / Group Model

A folder node (for UI rendering) might look like:

```js
{
  name: 'archived',
  path: 'C:/Code/archived',
  type: 'folder',
  children: [
    { type: 'project', name: 'old-app', ... },
    { type: 'folder',  name: 'experiments', children: [...] }
  ]
}
```

The dashboard currently shows a flat list of project cards. With folders, we'd want grouping — collapsible sections by folder, or a sidebar tree nav.

---

## API Surface

New or changed endpoints:

- `GET /api/fs` → return the full folder tree (folders + projects nested)
- `GET /api/projects` → keep as flat list (backwards compat, used for pm2 sync)
- `POST /api/folders` → create an org folder on disk (mkdir in `C:/Code/`)
- `DELETE /api/folders/:name` → remove (only if empty?)

---

## Open Questions

1. **How deep to recurse?** Free recursion seems fine given heuristic; add max depth?
2. **What if an org folder has a package.json?** (e.g., a monorepo root). Do we treat it as a project, or look inside for sub-packages? Probably treat as a project for now, user can ignore it.
3. **Submodule dirs** (`Server/`, `public/framework/`) — they have `.git` files (not dirs) pointing to the parent `.git/modules/`. Should we skip dirs that have a `.git` *file* vs *directory*? That would avoid surfacing submodules as standalone projects.
4. **Display in dashboard** — flat list with a "group" label? Collapsible sections? Sidebar tree? Big UX decision.
5. **Folder CRUD from UI** — is creating/renaming/deleting org folders in scope now, or just scanning them correctly first?
6. **Watch for changes** — if user creates a new folder/repo on disk, should Servex hot-reload the tree? (Probably yes, via `fs.watch` on `C:/Code/`)

---

## Proposed First Step

1. Add `isRepo(dir)` helper — checks for `.git/` (directory, not file) OR `package.json`
2. Make `load(dir)` recursive: if `isRepo` → `load_repo`, else recurse into subdirs
3. Introduce `FileSystem` class to hold the tree shape (even if UI doesn't use it yet)
4. Add `GET /api/fs` endpoint returning the tree

This keeps `this.projects` flat (pm2 sync unchanged) while adding tree awareness for the UI.

---

## UI / UX Plan

Per `servex.md`, the core of the dashboard is a **left sidebar file explorer**: drag-and-drop, copy/paste, multi-folder support, multiple root directories coexisting.

### Layout

```
┌─ sidenav ────────────────────┐
│  📁 C:/Code                  │
│    ▶ archived/               │
│    ▼ my-app/          [▶] [⋮]│
│        README.md             │
│        src/                  │
│    ─────────────────────     │
│  📁 C:/Projects              │
│    ▼ servex/          [▶] [⋮]│
│        ...                   │
└──────────────────────────────┘
```

- Root folders are collapsible sections added via `Servex.load(path)`
- Org folders inside each root collapse/expand on click
- Project nodes show run-state indicator + quick-action buttons (start `▶`, menu `⋮`)
- Selected node highlighted; clicking navigates to detail panel in main area

### Interaction Goals

- Click folder → expand/collapse
- Click project → open project detail panel
- Drag project/folder → reorder or re-parent (MVP: skip, just get tree rendering right)
- Right-click → context menu: rename, delete, open in explorer, copy path
- `+` button at root level → "Add folder" dialog (maps to `POST /api/folders`)

---

## Data Model — Use `List` Everywhere

The `List` class (`public/framework/ext/List/List.js`) is the right primitive for the whole tree.

### Class hierarchy

```js
import List from "/framework/ext/List/List.js";

// A folder node (org dir or root)
class FSFolder extends List {
    // children = mix of FSFolder + FSProject instances
}

// A leaf node (detected repo/project)
class FSProject extends List {
    // children = [] (leaf, or could hold files later)
    // status: 'stopped' | 'running' | 'errored'
    // port, scripts, path, name
}

// The top-level registry (multiple roots)
class FileSystemList extends List {
    // children = FSFolder[] (one per root path)
}
```

Key `List` APIs to lean on:
- `list.append(child)` / `list.add(child)` — add folders/projects to tree
- `list.walk(fn)` — recurse entire tree (great for flat-project extraction)
- `list.find(fn)` — locate a node by name or path
- `list.remove(child)` / `child.remove()` — remove from parent
- `list.clone()` — snapshot tree for diffing/undo
- `list.each(fn)` — iterate immediate children for rendering

`List` already has `parent` tracking via `adopt()`, so `child.parent` is always set — useful for breadcrumb paths and drag-drop re-parenting.

---

## Views — Extend `List.View`

`List.View.js` provides a base: `.list-bar` (name row) + `.list-children` (rendered children). Extend it per node type.

```js
import ListView from "/framework/ext/List/List.View.js";

class FSFolderView extends ListView {
    render(){
        super.render();
        this.ac("fs-folder");
        this.bar.prepend(icon("folder_open"));
        this.bar.append(icon("create_new_folder").click(() => this.list.add_child_dialog()));
    }
}

class FSProjectView extends ListView {
    render(){
        super.render();
        this.ac("fs-project");
        this.bar.prepend(icon("code"));
        this.status = div.c("status-dot").append_to(this.bar);
        this.bar.append(icon("play_arrow").click(() => this.list.start()));
        this.bar.append(icon("more_vert").click(() => this.show_context_menu()));
    }
    update(){
        this.status.attr("data-status", this.list.status);
    }
}

FSFolder.View  = FSFolderView;
FSProject.View = FSProjectView;
```

---

## Icons — Material Icons via Lew42

`public/framework/ext/Lew42/Lew42.js` loads the **Material Icons** Google font (via `this.font("Material Icons")`). The full icon list is at `public/framework/ui/icon/icons.txt`.

Use `icon(name)` from `public/framework/ui/icon/icon.js` — returns a `<span class="material-icons icon">name</span>`.

### Relevant icons for file-system UI

| Use case              | Icon name            |
|-----------------------|----------------------|
| Closed folder         | `folder`             |
| Open folder           | `folder_open`        |
| Shared/root folder    | `folder_shared`      |
| New folder            | `create_new_folder`  |
| Delete folder         | `folder_delete`      |
| Code / project        | `code`               |
| Source file           | `source`             |
| Description/readme    | `description`        |
| Play / start server   | `play_arrow`         |
| Stop server           | `stop`               |
| Restart               | `restart_alt`        |
| Running (spinner)     | `autorenew`          |
| Error                 | `error`              |
| More actions          | `more_vert`          |
| Add / new             | `add`                |
| Delete / remove       | `delete`             |
| Drag handle           | `drag_handle`        |
| Expand more           | `expand_more`        |
| Expand less / chevron | `chevron_right`      |
| Terminal              | `terminal`           |
| Git branch            | `merge` / `commit`   |
| Settings              | `settings`           |
| Copy path             | `content_copy`       |
| Open in explorer      | `open_in_new`        |

---

## Component Sketch

```
FileSystemPanel
  └─ FileSystemList (List instance, children = root FSFolders)
       ├─ FSFolder  "C:/Code"
       │    ├─ FSFolder  "archived"
       │    └─ FSProject "my-app"   ← port 3001, status: stopped
       └─ FSFolder  "C:/Projects"
            └─ FSProject "servex"   ← port 3000, status: running
```

Each node class has a `.View` subclass. `FileSystemPanel` renders the root `FileSystemList` and wires up socket events (pm2 status → `project.status` → `view.update()`).

---

## Implementation Order

1. **`FSProject` + `FSFolder`** classes (extend `List`) — data only, no rendering yet
2. **`FileSystemList`** — holds roots, exposes `add_root(path)`, `flat_projects()` (via `walk`)
3. **`FSFolderView` / `FSProjectView`** — extend `List.View`, minimal rendering
4. **Wire to `GET /api/fs`** — populate `FileSystemList` from server tree JSON
5. **Wire pm2 events** → `project.status` → `view.update()`
6. **Collapse/expand** — toggle `.list-children` visibility, swap `folder` / `folder_open` icon
7. **Context menu** — right-click / `more_vert` → rename, delete, copy path, open in explorer
