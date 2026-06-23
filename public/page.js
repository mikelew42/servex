import app, { el, div, h1, style } from "/app.js";
import Socket from "/framework/ext/Socket/Socket.js";

style(`
  .project-card {
    background: #ffffff;
    border-radius: 8px;
    padding: 1em 1.2em 1.3em;
    width: 400px;
    margin-bottom: 10px;
  }
  .projects { display: flex; flex-wrap: wrap; padding: 16px; gap: 1em; }
  .project-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .project-name { font-weight: 600; }
  .project-status { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: #eee; }
  .project-status.stopped { color: #636363; }
  .project-status.online { background: #1a472a; color: #4ade80; }
  .project-status.errored { background: #4a1a1a; color: #f87171; }
  .project-status.launching { background: #2a2a1a; color: #facc15; }
  .project-url { font-size: 12px; color: #7c9cbf; display: block; margin-bottom: 8px; }
  .project-actions { display: flex; gap: 6px; margin-top: 8px; }
  .btn-start { padding: 3px 10px; border-radius: 4px; cursor: pointer; background: #1a472a; color: #4ade80; border: none; }
  .btn-stop  { padding: 3px 10px; border-radius: 4px; cursor: pointer; background: #4a1a1a; color: #f87171; border: none; }
`);

const socket = Socket.singleton();
const $cards = new Map();

h1("Servex");

const $list = div.c("projects");

fetch('/api/projects')
  .then(r => r.json())
  .then(projects => {
    $list.empty(() => {
      for (const project of projects) render(project);
    });
  });

socket.projectStatus = (name, status) => {
  const card = $cards.get(name);
  if (!card) return;
  card.$status.rc('stopped online errored launching').ac(status).text(status);
  const running = status === 'online' || status === 'launching';
  running ? card.$start.hide() : card.$start.show();
  status === 'online' ? card.$stop.show() : card.$stop.hide();
};

function render(project) {
  let $status, $start, $stop;

  div.c("project-card", () => {
    div.c("project-header", () => {
      div.c("project-name", project.name);
      $status = div.c("project-status " + project.status, project.status);
    });
    el("a", project.url).href(project.url).attr("target", "_blank").ac("project-url");
    div.c("project-actions", () => {
      $start = el("button", "start").ac("btn-start")
        .click(() => fetch(`/api/projects/${project.name}/start`, { method: 'POST' }));
      $stop = el("button", "stop").ac("btn-stop")
        .click(() => fetch(`/api/projects/${project.name}/stop`, { method: 'POST' }));
    });
  });

  const running = project.status === 'online' || project.status === 'launching';
  running ? $start.hide() : $stop.hide();
  if (project.status !== 'online') $stop.hide();
  if (!project.can_start) { $start.hide(); $stop.hide(); }

  $cards.set(project.name, { $status, $start, $stop });
}
