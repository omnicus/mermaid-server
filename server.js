const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { marked } = require("marked");

const PORT = process.env.PORT || 4000;
const CONFIG_PATH = path.join(os.homedir(), ".mermaid-server.json");

// Mime types for static assets
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "application/font-woff",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "application/font-otf",
  ".wasm": "application/wasm",
};

// State
let config = {
  projects: [],
  settings: { sidebarSticky: true }
};

const clients = new Map(); // projectId -> Set of res objects
const watchers = new Map(); // projectId -> fs.FSWatcher

// Config helpers
const loadConfig = () => {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      config = { ...config, ...data };
    } catch (e) {
      console.error("Failed to load config:", e.message);
    }
  }
};

const saveConfig = () => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("Failed to save config:", e.message);
  }
};

loadConfig();

// Initial project from CLI if provided
const argPath = process.argv[2];
if (argPath) {
  const absolutePath = path.resolve(argPath);
  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
    const existing = config.projects.find(p => p.path === absolutePath);
    if (!existing) {
      config.projects.push({
        id: crypto.randomBytes(4).toString("hex"),
        name: path.basename(absolutePath) || "Default",
        path: absolutePath
      });
      saveConfig();
    }
  }
}

// Custom extension to handle mermaid code blocks
const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Remove consecutive hyphens
};

const renderer = {
  code(token) {
    if (token.lang === "mermaid") {
      return `<div class="mermaid">${token.text}</div>`;
    }
    const lang = token.lang ? ` class="language-${token.lang}"` : "";
    return `<pre><code${lang}>${token.text}</code></pre>`;
  },
  heading(token) {
    const id = slugify(token.text);
    return `<h${token.depth} id="${id}"><a href="#${id}" class="heading-anchor" aria-label="Link to this section">#</a>${token.text}</h${token.depth}>`;
  },
};

marked.use({ renderer, gfm: true, breaks: true });

const getH1Title = (md) => {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
};

const html = (content, title = "Mermaid Server", projectId = null, nav = "") => {
  const projectListHtml = config.projects
    .map(p => `
      <div class="project-item ${p.id === projectId ? 'active' : ''}" data-id="${p.id}">
        <a href="/p/${p.id}/" class="project-link">
          <span class="project-name" title="${p.path}">${p.name}</span>
        </a>
        <div class="project-actions">
          <button onclick="renameProject('${p.id}', '${p.name}')" title="Rename">✎</button>
          <button onclick="deleteProject('${p.id}')" title="Remove">×</button>
        </div>
      </div>
    `).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({startOnLoad: true, theme: 'default'});</script>
  <style>
    :root {
      --sidebar-width: 260px;
      --bg-color: #ffffff;
      --sidebar-bg: #f8f9fa;
      --border-color: #e9ecef;
      --primary-color: #0066cc;
      --text-color: #333;
      --radius-sm: 4px;
      --radius-md: 8px;
    }
    body { 
      font-family: system-ui, -apple-system, sans-serif; 
      margin: 0;
      padding: 0;
      display: flex;
      height: 100vh;
      color: var(--text-color);
      overflow: hidden;
    }
    
    /* Sidebar */
    #sidebar {
      width: var(--sidebar-width);
      flex-shrink: 0;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      transition: margin-left 0.3s ease;
      z-index: 1000;
    }
    #sidebar.hidden {
      margin-left: calc(-1 * var(--sidebar-width));
    }
    .sidebar-header {
      padding: 1rem;
      padding-left: 4rem; /* Space for burger */
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 48px;
    }
    .sidebar-header h2 { margin: 0; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    
    .project-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem 0;
    }
    .project-item {
      display: flex;
      align-items: center;
      padding: 0.5rem 1rem;
      gap: 0.5rem;
      cursor: pointer;
    }
    .project-item:hover { background: #e9ecef; }
    .project-item.active { 
      background: #dee2e6; 
      border-left: 4px solid var(--primary-color);
      padding-left: calc(1rem - 4px);
    }
    .project-link { 
      flex: 1; 
      text-decoration: none; 
      color: inherit; 
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .project-name { font-weight: 500; }
    .project-actions {
      display: none;
      gap: 4px;
    }
    .project-item:hover .project-actions { display: flex; }
    .project-actions button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 5px;
      color: #666;
      border-radius: 3px;
    }
    .project-actions button:hover { background: #ced4da; color: #000; }

    .sidebar-footer {
      padding: 1rem;
      border-top: 1px solid var(--border-color);
    }
    .btn-add {
      width: 100%;
      padding: 0.5rem;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    /* Main Content */
    #main {
      flex: 1;
      overflow-y: auto;
      padding: 0 2rem 2rem 2rem;
      position: relative;
      scroll-behavior: smooth;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    
    .content-header {
      position: sticky;
      top: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      z-index: 100;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 2rem;
    }

    /* Progress Bar */
    .progress-bar {
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 0%;
      height: 3px;
      background: var(--primary-color);
      transition: width 0.1s;
    }

    #sidebar-toggle {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 2000;
      background: #fff;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      width: 32px;
      height: 32px;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      color: #555;
    }
    #sidebar-toggle:hover {
      background: #f0f0f0;
      color: #000;
    }

    .back-link { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
    }
    .back-link a {
      color: var(--primary-color);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .back-link a:hover { text-decoration: underline; }

    .file-list { list-style: none; padding: 0; margin: 0; }
    .file-list li { border-bottom: 1px solid #eee; }
    .file-list a { 
      display: flex; 
      align-items: center; 
      gap: 0.75rem; 
      padding: 0.75rem 0; 
      color: inherit; 
      text-decoration: none;
    }
    .file-list a:hover { color: var(--primary-color); }
    .file-icon { font-size: 1.1rem; }

    .mermaid { 
      background: #fafafa; 
      padding: 1.5rem; 
      border-radius: var(--radius-md);
      margin: 1.5rem 0;
      overflow-x: auto;
      cursor: pointer;
      position: relative;
      transition: box-shadow 0.2s;
      border: 1px solid var(--border-color);
    }
    .mermaid:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .mermaid::after {
      content: 'Click to expand';
      position: absolute;
      top: 8px; right: 8px;
      font-size: 0.7rem; color: #888;
      background: white; padding: 2px 6px;
      border-radius: 3px; opacity: 0;
      transition: opacity 0.2s;
    }
    .mermaid:hover::after { opacity: 1; }
    
    .diagram-modal {
      display: none;
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.85);
      z-index: 3000;
      justify-content: center; align-items: center;
      padding: 2rem; box-sizing: border-box;
    }
    .diagram-modal.active { display: flex; }
    .diagram-modal-content {
      background: white; border-radius: var(--radius-md);
      padding: 2rem; width: 90vw; max-height: 90vh;
      overflow: auto; position: relative;
    }
    .diagram-modal-close {
      position: absolute; top: 10px; right: 10px;
      background: #f44336; color: white; border: none;
      width: 32px; height: 32px; border-radius: 50%;
      cursor: pointer; font-size: 1.2rem; z-index: 3001;
    }
    
    pre { background: #f4f4f4; padding: 1rem; border-radius: 8px; overflow-x: auto; border: 1px solid var(--border-color); }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
    
    .reload-indicator {
      position: fixed; top: 10px; right: 10px;
      background: #4caf50; color: white;
      padding: 0.3rem 0.6rem; border-radius: 4px;
      font-size: 0.8rem; opacity: 0; transition: opacity 0.3s;
      z-index: 2000;
    }
    .reload-indicator.show { opacity: 1; }

    h1, h2, h3, h4, h5, h6 { position: relative; }
    .heading-anchor {
      position: absolute;
      left: -1.5rem;
      top: 50%;
      transform: translateY(-50%);
      color: #ccc;
      opacity: 0;
      font-weight: 400;
      text-decoration: none;
      transition: opacity 0.15s ease;
    }
    h1:hover .heading-anchor, h2:hover .heading-anchor, h3:hover .heading-anchor, 
    h4:hover .heading-anchor, h5:hover .heading-anchor, h6:hover .heading-anchor { opacity: 1; }
    .heading-anchor:hover { color: var(--primary-color); }

    .toc-sidebar {
      position: fixed;
      top: 6rem;
      right: 2rem;
      width: 200px;
      max-height: calc(100vh - 8rem);
      overflow-y: auto;
      padding: 1rem;
      background: var(--sidebar-bg);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
      font-size: 0.85rem;
      opacity: 0;
      transform: translateX(10px);
      animation: tocFadeIn 0.3s ease forwards;
    }
    @keyframes tocFadeIn { to { opacity: 1; transform: translateX(0); } }
    .toc-title { font-weight: 600; margin-bottom: 0.75rem; font-size: 0.75rem; text-transform: uppercase; color: #666; }
    .toc-list { list-style: none; padding: 0; margin: 0; }
    .toc-list a {
      display: block;
      padding: 0.25rem 0;
      color: #666;
      text-decoration: none;
      border-left: 2px solid transparent;
      padding-left: 0.75rem;
      transition: all 0.15s;
    }
    .toc-list a:hover { color: var(--primary-color); }
    .toc-list a.active { color: var(--primary-color); border-left-color: var(--primary-color); font-weight: 500; }
    .toc-h3 { padding-left: 1.5rem !important; }
    .toc-h4 { padding-left: 2.25rem !important; }

    @media (max-width: 1300px) { .toc-sidebar { display: none; } }

    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 4000;
      justify-content: center; align-items: center;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: white; padding: 2rem; border-radius: 8px;
      width: 450px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-group input { width: 100%; padding: 0.5rem; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    .btn-primary { background: var(--primary-color); color: white; }
    .btn-secondary { background: #eee; }

    .browser-container {
      border: 1px solid var(--border-color);
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 0.5rem;
      background: #fff;
    }
    .browser-item {
      padding: 6px 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
    }
    .browser-item:hover { background: #f0f0f0; }
  </style>
</head>
<body>
  <aside id="sidebar" class="${config.settings.sidebarSticky ? '' : 'hidden'}">
    <div class="sidebar-header">
      <h2>Projects</h2>
    </div>
    <div class="project-list">
      ${projectListHtml}
    </div>
    <div class="sidebar-footer">
      <button class="btn-add" onclick="showAddProject()">+ Add Project</button>
    </div>
  </aside>

  <button id="sidebar-toggle" onclick="toggleSidebar()" title="Toggle Sidebar">☰</button>

  <main id="main">
    ${nav ? `<header class="content-header"><div class="container">${nav}</div><div class="progress-bar" id="progress-bar"></div></header>` : ''}
    <div class="container" style="${nav ? '' : 'padding-top: 3rem;'}">
      <div class="reload-indicator" id="reload-indicator">Reloaded</div>
      ${content}
    </div>
  </main>

  <div class="diagram-modal" id="diagram-modal">
    <button class="diagram-modal-close" id="modal-close">&times;</button>
    <div class="diagram-modal-content" id="modal-content"></div>
  </div>

  <div class="modal-overlay" id="project-modal">
    <div class="modal">
      <h3 id="modal-title">Add Project</h3>
      <input type="hidden" id="project-id">
      <div class="form-group">
        <label for="project-name-input">Project Name</label>
        <input type="text" id="project-name-input" placeholder="e.g. My Documentation">
      </div>
      <div class="form-group">
        <label for="project-path-input">Absolute Path</label>
        <div style="display: flex; gap: 0.5rem;">
          <input type="text" id="project-path-input" placeholder="/Users/me/docs" style="flex: 1;">
          <button class="btn btn-secondary" onclick="toggleBrowser()" style="padding: 0.5rem;">Browse</button>
        </div>
        <div id="file-browser" class="browser-container" style="display: none;"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="hideProjectModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveProject()">Save</button>
      </div>
    </div>
  </div>

  <script>
    const projectId = ${projectId ? `'${projectId}'` : 'null'};
    const mainEl = document.getElementById('main');
    
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('hidden');
      const isSticky = !sidebar.classList.contains('hidden');
      fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sidebarSticky: isSticky })
      });
    }

    function showAddProject() {
      document.getElementById('modal-title').innerText = 'Add Project';
      document.getElementById('project-id').value = '';
      document.getElementById('project-name-input').value = '';
      document.getElementById('project-path-input').value = '';
      document.getElementById('project-modal').classList.add('active');
    }

    function hideProjectModal() {
      document.getElementById('project-modal').classList.remove('active');
    }

    async function renameProject(id, currentName) {
      const name = prompt('Rename project to:', currentName);
      if (name && name !== currentName) {
        await updateProject(id, { name });
      }
    }

    async function updateProject(id, data) {
      const res = await fetch('/api/projects/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) location.reload();
    }

    async function deleteProject(id) {
      if (!confirm('Remove this project?')) return;
      const res = await fetch('/api/projects/' + id, { method: 'DELETE' });
      if (res.ok) {
        if (projectId === id) window.location.href = '/';
        else location.reload();
      }
    }

    async function saveProject() {
      const id = document.getElementById('project-id').value;
      const name = document.getElementById('project-name-input').value;
      const path = document.getElementById('project-path-input').value;
      if (!name || !path) return alert('Name and Path are required');
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path })
      });
      if (res.ok) location.reload();
    }

    async function toggleBrowser() {
      const browser = document.getElementById('file-browser');
      if (browser.style.display === 'none') {
        browser.style.display = 'block';
        await browseTo(document.getElementById('project-path-input').value || '');
      } else {
        browser.style.display = 'none';
      }
    }

    async function browseTo(path) {
      const res = await fetch('/api/browse?path=' + encodeURIComponent(path));
      if (!res.ok) return;
      const data = await res.json();
      document.getElementById('project-path-input').value = data.currentPath;
      const container = document.getElementById('file-browser');
      container.innerHTML = '';
      if (data.parentPath && data.parentPath !== data.currentPath) {
        const item = document.createElement('div');
        item.className = 'browser-item';
        item.innerHTML = '📁 .. (Up)';
        item.onclick = () => browseTo(data.parentPath);
        container.appendChild(item);
      }
      data.entries.filter(e => e.isDirectory).forEach(entry => {
        const item = document.createElement('div');
        item.className = 'browser-item';
        item.innerHTML = '📁 ' + entry.name;
        item.onclick = () => browseTo(entry.path);
        container.appendChild(item);
      });
      const nameInput = document.getElementById('project-name-input');
      if (!nameInput.value) {
        const parts = data.currentPath.split(/[\\\\/]/);
        nameInput.value = parts.pop() || 'New Project';
      }
    }

    if (projectId) {
      let evtSource;
      function connectSSE() {
        if (evtSource) evtSource.close();
        evtSource = new EventSource('/__reload?projectId=' + projectId);
        evtSource.onmessage = (e) => {
          if (e.data === 'reload') {
            document.getElementById('reload-indicator').classList.add('show');
            evtSource.close();
            setTimeout(() => location.reload(), 300);
          }
        };
      }
      connectSSE();
      window.addEventListener('beforeunload', () => { if (evtSource) evtSource.close(); });
    }

    const modal = document.getElementById('diagram-modal');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.getElementById('modal-close');
    function openModal(diagramHtml) {
      modalContent.innerHTML = diagramHtml;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      const svg = modalContent.querySelector('svg');
      if (svg) {
        svg.removeAttribute('width'); svg.removeAttribute('height');
        svg.style.width = '100%'; svg.style.height = 'auto';
      }
    }
    document.addEventListener('click', (e) => {
      const mermaidEl = e.target.closest('.mermaid');
      if (mermaidEl && !modal.classList.contains('active')) openModal(mermaidEl.innerHTML);
    });
    modalClose.onclick = () => { modal.classList.remove('active'); document.body.style.overflow = ''; };
    modal.onclick = (e) => { if (e.target === modal) modalClose.onclick(); };
    document.onkeydown = (e) => { if (e.key === 'Escape') modalClose.onclick(); };

    function generateTOC() {
      const headings = document.querySelectorAll('h2, h3, h4');
      if (headings.length < 3) return;
      const toc = document.createElement('nav');
      toc.className = 'toc-sidebar';
      toc.innerHTML = '<div class="toc-title">On this page</div><ul class="toc-list"></ul>';
      const list = toc.querySelector('ul');
      headings.forEach(h => {
        if (!h.id) return;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = h.textContent.replace(/^#/, '');
        a.className = 'toc-' + h.tagName.toLowerCase();
        a.dataset.target = h.id;
        li.appendChild(a);
        list.appendChild(li);
      });
      document.body.appendChild(toc);
      const tocLinks = toc.querySelectorAll('a');
      function updateActiveTOC() {
        let current = '';
        headings.forEach(h => {
          if (h.getBoundingClientRect().top <= 120) current = h.id;
        });
        tocLinks.forEach(link => link.classList.toggle('active', link.dataset.target === current));
      }
      mainEl.addEventListener('scroll', updateActiveTOC, { passive: true });
      updateActiveTOC();
    }

    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      mainEl.addEventListener('scroll', () => {
        const st = mainEl.scrollTop;
        const sh = mainEl.scrollHeight - mainEl.clientHeight;
        const percent = sh > 0 ? (st / sh) * 100 : 0;
        progressBar.style.width = percent + '%';
      }, { passive: true });
    }
    generateTOC();
  </script>
</body>
</html>
`;
};

const getMarkdownFiles = (dir, prefix = "", recursive = true) => {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const fullPath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      if (recursive) files.push(...getMarkdownFiles(path.join(dir, entry.name), fullPath, true));
      else files.push(fullPath + "/");
    } else if (entry.name.endsWith(".md")) files.push(fullPath);
  }
  return files;
};

let debounceTimers = new Map();
const notifyClients = (projectId) => {
  if (debounceTimers.has(projectId)) clearTimeout(debounceTimers.get(projectId));
  const timer = setTimeout(() => {
    const projectClients = clients.get(projectId);
    if (!projectClients) return;
    for (const client of projectClients) {
      if (client.writable && !client.finished) client.write("data: reload\n\n");
    }
    debounceTimers.delete(projectId);
  }, 100);
  debounceTimers.set(projectId, timer);
};

const setupWatcher = (projectId, dir) => {
  if (watchers.has(projectId)) return;
  try {
    const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith(".md")) notifyClients(projectId);
    });
    watchers.set(projectId, watcher);
  } catch (err) { console.error(`Failed to watch ${dir}:`, err.message); }
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === "/__reload") {
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return res.end();
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    res.write("data: connected\n\n");
    const heartbeat = setInterval(() => {
      if (res.writableEnded || res.finished) { clearInterval(heartbeat); return; }
      res.write(": ping\n\n");
    }, 15000);
    if (!clients.has(projectId)) clients.set(projectId, new Set());
    clients.get(projectId).add(res);
    const project = config.projects.find(p => p.id === projectId);
    if (project) setupWatcher(projectId, project.path);
    const cleanup = () => {
      const projectClients = clients.get(projectId);
      if (projectClients) {
        projectClients.delete(res);
        if (projectClients.size === 0) {
          const watcher = watchers.get(projectId);
          if (watcher) { watcher.close(); watchers.delete(projectId); }
        }
      }
      clearInterval(heartbeat);
    };
    req.on("close", cleanup);
    return;
  }
  if (pathname.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
    if (pathname === "/api/browse") {
      const targetPath = url.searchParams.get("path") || os.homedir();
      try {
        const entries = fs.readdirSync(targetPath, { withFileTypes: true });
        const result = entries.filter(e => !e.name.startsWith(".") || e.name === ".git")
          .map(e => ({ name: e.name, isDirectory: e.isDirectory(), path: path.join(targetPath, e.name) }))
          .sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1));
        res.end(JSON.stringify({ currentPath: targetPath, parentPath: path.dirname(targetPath), entries: result }));
      } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
      return;
    }
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const data = body ? JSON.parse(body) : {};
        if (pathname === "/api/projects" && req.method === "POST") {
          const newProject = { id: crypto.randomBytes(4).toString("hex"), name: data.name, path: path.resolve(data.path) };
          config.projects.push(newProject); saveConfig(); res.end(JSON.stringify(newProject));
        } else if (pathname === "/api/settings" && req.method === "PATCH") {
          config.settings = { ...config.settings, ...data }; saveConfig(); res.end(JSON.stringify(config.settings));
        } else if (pathname.startsWith("/api/projects/") && req.method === "PATCH") {
          const id = pathname.split("/").pop();
          const p = config.projects.find(p => p.id === id);
          if (p) { Object.assign(p, data); if (data.path) p.path = path.resolve(data.path); saveConfig(); res.end(JSON.stringify(p)); }
          else { res.statusCode = 404; res.end(); }
        } else if (pathname.startsWith("/api/projects/") && req.method === "DELETE") {
          config.projects = config.projects.filter(p => p.id !== pathname.split("/").pop());
          saveConfig(); res.end(JSON.stringify({ success: true }));
        } else { res.statusCode = 404; res.end(); }
      } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }
  if (pathname === "/") {
    res.end(html(`<h1>Mermaid Server</h1><p>Select a project from the sidebar.</p><ul class="file-list">${config.projects.map(p => `<li><a href="/p/${p.id}/">📁 <span>${p.name}</span></a></li>`).join("")}</ul>`, "Mermaid Server", null, ""));
    return;
  }
  const projectMatch = pathname.match(/^\/p\/([^/]+)(\/.*)?/);
  if (projectMatch) {
    const projectId = projectMatch[1];
    const subPath = decodeURIComponent(projectMatch[2] || "/");
    const project = config.projects.find(p => p.id === projectId);
    if (!project) return res.end(html("<h1>Project Not Found</h1>"));
    const fullPath = path.join(project.path, subPath);
    const relative = path.relative(project.path, fullPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return res.end(html("<h1>Access Denied</h1>"));
    if (!fs.existsSync(fullPath)) return res.end(html("<h1>404 - Not Found</h1>", "Not Found", projectId));
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      const readmePath = path.join(fullPath, "README.md");
      const showAll = url.searchParams.get("all") === "true";
      if (fs.existsSync(readmePath) && !showAll) {
        const content = fs.readFileSync(readmePath, "utf-8");
        const title = getH1Title(content) || "README.md";
        const nav = `<div class="back-link"><a href="javascript:history.back()">&larr; Back</a><a href="?all=true">Show all files</a></div>`;
        res.end(html(marked(content), title, projectId, nav));
      } else {
        const files = getMarkdownFiles(fullPath, subPath === "/" ? "" : subPath, !showAll);
        const list = files.sort().map(f => {
          const isFolder = f.endsWith("/");
          const name = isFolder ? f.slice(0, -1).split("/").pop() : path.basename(f);
          return `<li><a href="/p/${projectId}/${f}">${isFolder ? '📁' : '📄'} <span>${name}</span></a></li>`;
        }).join("");
        const nav = `<div class="back-link"><a href="javascript:history.back()">&larr; Back</a></div>`;
        res.end(html(`<h1>${path.basename(fullPath) || project.name}</h1><ul class="file-list">${list || "<li>No docs found</li>"}</ul>`, project.name, projectId, nav));
      }
    } else if (fullPath.endsWith(".md")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const title = getH1Title(content) || path.basename(fullPath);
      const nav = `<div class="back-link"><a href="javascript:history.back()">&larr; Back</a></div>`;
      res.end(html(marked(content), title, projectId, nav));
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
      fs.createReadStream(fullPath).pipe(res);
    }
  } else { res.statusCode = 404; res.end(html("<h1>404 - Not Found</h1>")); }
});

server.listen(PORT, () => {
  console.log(`\nMermaid Server running at http://localhost:${PORT}`);
  console.log(`Config: ${CONFIG_PATH}\n`);
});
