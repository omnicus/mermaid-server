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
        nameInput.value = currentBrowserPath.split(/[/\]/).pop() || 'New Project';
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
  </script>
</body>
</html>
