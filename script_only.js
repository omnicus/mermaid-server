  <style>
    :root {
      --sidebar-width: 260px;
      --bg-color: #ffffff;
      --sidebar-bg: #f8f9fa;
      --border-color: #e9ecef;
      --primary-color: #0066cc;
      --text-color: #333;
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
      padding-left: 3.5rem; /* Space for burger */
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 40px;
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
      padding: 1rem 2rem 2rem 2rem;
      position: relative;
      margin-left: 0;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding-top: 3rem; /* Space for burger when sidebar hidden */
    }
    
    #sidebar-toggle {
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 2000; /* Always on top */
      background: white;
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
    }
    
    /* When sidebar is visible, main shouldn't be covered if we want a split view, 
       but here we seem to want the sidebar to push or overlay. 
       Based on 'display: flex' on body, it pushes. */
    
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
      background: rgba(0,0,0,0.8);
      z-index: 1000;
      justify-content: center; align-items: center;
      padding: 2rem; box-sizing: border-box;
    }
    .diagram-modal.active { display: flex; }
    .diagram-modal-content {
      background: white; border-radius: 8px;
      padding: 2rem; width: 90vw; max-height: 90vh;
      overflow: auto; position: relative;
    }
    .diagram-modal-close {
      position: absolute; top: 10px; right: 10px;
      background: #f44336; color: white; border: none;
      width: 32px; height: 32px; border-radius: 50%;
      cursor: pointer; font-size: 1.2rem; z-index: 1001;
    }
    
    pre { background: #f4f4f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
    a { color: var(--primary-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .file-list { list-style: none; padding: 0; }
    .file-list li { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
    .back-link { margin-bottom: 1rem; }
    
    .reload-indicator {
      position: fixed; top: 10px; right: 10px;
      background: #4caf50; color: white;
      padding: 0.3rem 0.6rem; border-radius: 4px;
      font-size: 0.8rem; opacity: 0; transition: opacity 0.3s;
    }
    .reload-indicator.show { opacity: 1; }

    /* Forms */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 200;
      justify-content: center; align-items: center;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: white; padding: 2rem; border-radius: 8px;
      width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .modal h3 { margin-top: 0; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-group input { width: 100%; padding: 0.5rem; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    .btn-primary { background: var(--primary-color); color: white; }
    /* Browser in Modal */
    .browser-container {
      border: 1px solid var(--border-color);
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
      margin-top: 0.5rem;
      background: #fff;
    }
    .browser-item {
      padding: 4px 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
    }
    .browser-item:hover { background: #f0f0f0; }
    .browser-item.folder { font-weight: 500; }
    .browser-item.parent { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <aside id="sidebar" class="">
    <div class="sidebar-header">
      <h2>Projects</h2>
    </div>
    <div class="project-list">
      
      <div class="project-item " data-id="f00e31d0">
        <a href="/p/f00e31d0/" class="project-link">
          <span class="project-name" title="/Users/ejonassen/Documents/GitHub/mermaid-server">mermaid-server</span>
        </a>
        <div class="project-actions">
          <button onclick="renameProject('f00e31d0', 'mermaid-server')" title="Rename">✎</button>
          <button onclick="deleteProject('f00e31d0')" title="Remove">×</button>
        </div>
      </div>
    
    </div>
    <div class="sidebar-footer">
      <button class="btn-add" onclick="showAddProject()">+ Add Project</button>
    </div>
  </aside>

  <button id="sidebar-toggle" onclick="toggleSidebar()" title="Toggle Sidebar">☰</button>

  <main id="main">
    <div class="container">
      <div class="reload-indicator" id="reload-indicator">Reloaded</div>
      
      <h1>Mermaid Server</h1>
      <p>Select a project from the sidebar or add a new one to get started.</p>
      <div style="margin-top: 2rem;">
        <h3>Registered Projects</h3>
        <ul class="file-list">
          <li><a href="/p/f00e31d0/"><strong>mermaid-server</strong> - <small>/Users/ejonassen/Documents/GitHub/mermaid-server</small></a></li>
        </ul>
      </div>
    
    </div>
  </main>

  <!-- Fullscreen modal for diagrams -->
  <div class="diagram-modal" id="diagram-modal">
    <button class="diagram-modal-close" id="modal-close">&times;</button>
    <div class="diagram-modal-content" id="modal-content"></div>
  </div>

  <!-- Add/Edit Project Modal -->
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
          <input type="text" id="project-path-input" placeholder="/Users/me/projects/docs" style="flex: 1;">
          <button class="btn btn-secondary" onclick="toggleBrowser()" style="padding: 0.5rem;">Browse</button>
        </div>
        <div id="file-browser" class="browser-container" style="display: none;">
          <!-- Browser content injected here -->
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="hideProjectModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveProject()">Save</button>
      </div>
    </div>
  </div>

  <script>
    const projectId = null;
    
    // Browser logic
    let currentBrowserPath = '';
    
    async function toggleBrowser() {
      const browser = document.getElementById('file-browser');
      if (browser.style.display === 'none') {
        browser.style.display = 'block';
        const initialPath = document.getElementById('project-path-input').value || '';
        await browseTo(initialPath);
      } else {
        browser.style.display = 'none';
      }
    }

    async function browseTo(path) {
      const res = await fetch('/api/browse?path=' + encodeURIComponent(path));
      if (!res.ok) {
        // If path failed, try home
        if (path !== '') return browseTo('');
        return;
      }
      const data = await res.json();
      currentBrowserPath = data.currentPath;
      document.getElementById('project-path-input').value = currentBrowserPath;
      
      const container = document.getElementById('file-browser');
      container.innerHTML = '';
      
      // Parent link
      if (data.parentPath && data.parentPath !== data.currentPath) {
        const item = document.createElement('div');
        item.className = 'browser-item parent';
        item.innerHTML = '📁 .. (Up)';
        item.onclick = () => browseTo(data.parentPath);
        container.appendChild(item);
      }
      
      data.entries.filter(e => e.isDirectory).forEach(entry => {
        const item = document.createElement('div');
        item.className = 'browser-item folder';
        item.innerHTML = '📁 ' + entry.name;
        item.onclick = () => browseTo(entry.path);
        container.appendChild(item);
      });
      
      // Auto-set name if empty
      const nameInput = document.getElementById('project-name-input');
      if (!nameInput.value) {
        const parts = currentBrowserPath.split(/[\\/]/);
        nameInput.value = parts.pop() || 'New Project';
      }
    }

    // Sidebar logic
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

    // Project management
    function showAddProject() {
      document.getElementById('modal-title').innerText = 'Add Project';
      document.getElementById('project-id').value = '';
      document.getElementById('project-name-input').value = '';
      document.getElementById('project-path-input').value = '';
      document.getElementById('project-modal').classList.add('active');
    }

    function renameProject(id, currentName) {
      const name = prompt('Rename project to:', currentName);
      if (name && name !== currentName) {
        updateProject(id, { name });
      }
    }

    function hideProjectModal() {
      document.getElementById('project-modal').classList.remove('active');
    }

    async function saveProject() {
      const id = document.getElementById('project-id').value;
      const name = document.getElementById('project-name-input').value;
      const path = document.getElementById('project-path-input').value;
      
      if (!name || !path) return alert('Name and Path are required');

      if (id) {
        await updateProject(id, { name, path });
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, path })
        });
        if (res.ok) location.reload();
        else alert('Failed to add project');
      }
    }

    async function updateProject(id, data) {
      const res = await fetch('/api/projects/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) location.reload();
      else alert('Failed to update project');
    }

    async function deleteProject(id) {
      if (!confirm('Remove this project? (Local files will not be deleted)')) return;
      const res = await fetch('/api/projects/' + id, { method: 'DELETE' });
      if (res.ok) {
        if (projectId === id) window.location.href = '/';
        else location.reload();
      }
    }

    // Live reload
    if (projectId) {
      const evtSource = new EventSource('/__reload?projectId=' + projectId);
      evtSource.onmessage = (e) => {
        if (e.data === 'reload') {
          const indicator = document.getElementById('reload-indicator');
          indicator.classList.add('show');
          evtSource.close();
          setTimeout(() => location.reload(), 300);
        }
      };
      window.addEventListener('beforeunload', () => evtSource.close());
    }

    // Modal & Mermaid logic (preserved)
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
