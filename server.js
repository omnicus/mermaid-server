/**
 * Mermaid Server
 *
 * A local Node.js server to render Markdown files with Mermaid diagrams.
 * Supports multiple projects, live reload, and persistent configuration.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Import modules
const config = require('./lib/config');
const { html, renderMarkdown, getH1Title } = require('./lib/renderer');
const {
  getMimeType,
  getMarkdownFiles,
  browseDirectory,
  isPathWithinProject,
  setupWatcher,
  addClient,
  removeClient,
} = require('./lib/utils');

const PORT = process.env.PORT || 4000;

// Initialize project from CLI argument if provided
config.addProjectFromCLI(process.argv[2]);

/**
 * Handle SSE reload endpoint
 */
const handleReloadEndpoint = (req, res, url) => {
  const projectId = url.searchParams.get('projectId');
  if (!projectId) return res.end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('data: connected\n\n');

  const heartbeat = setInterval(() => {
    if (res.writableEnded || res.finished) {
      clearInterval(heartbeat);
      return;
    }
    res.write(': ping\n\n');
  }, 15000);

  addClient(projectId, res);

  const project = config.findProject(projectId);
  if (project) setupWatcher(projectId, project.path);

  const cleanup = () => {
    removeClient(projectId, res);
    clearInterval(heartbeat);
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
};

/**
 * Handle API endpoints
 */
const handleApiRequest = (req, res, url, pathname) => {
  res.setHeader('Connection', 'close');
  res.setHeader('Content-Type', 'application/json');

  // Browse endpoint
  if (pathname === '/api/browse') {
    const targetPath = url.searchParams.get('path');
    try {
      const result = browseDirectory(targetPath);
      res.end(JSON.stringify(result));
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // File read/write API for editing markdown files
  if (pathname === '/api/file') {
    const projectId = url.searchParams.get('projectId');
    const filePath = url.searchParams.get('path');
    const project = config.findProject(projectId);

    if (!project) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Project not found' }));
      return;
    }

    const fullPath = path.join(project.path, filePath);

    if (!isPathWithinProject(project.path, filePath)) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Access denied' }));
      return;
    }

    if (!fullPath.endsWith('.md')) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Only markdown files can be edited' }));
      return;
    }

    if (req.method === 'GET') {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        res.end(JSON.stringify({ content, path: filePath }));
      } catch (e) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'File not found' }));
      }
      return;
    }

    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (typeof data.content !== 'string') {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Content is required' }));
            return;
          }
          fs.writeFileSync(fullPath, data.content, 'utf-8');
          res.end(JSON.stringify({ success: true, path: filePath }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // Other API endpoints (projects, settings)
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};

      const favoriteMatch = pathname.match(
        /^\/api\/projects\/([^/]+)\/favorites(?:\/([^/]+))?$/,
      );

      if (favoriteMatch) {
        const projectId = favoriteMatch[1];
        const favoriteId = favoriteMatch[2];

        if (req.method === 'POST' && !favoriteId) {
          if (typeof data.path !== 'string' || typeof data.name !== 'string') {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Name and path are required' }));
            return;
          }
          const favorite = config.addFavorite(projectId, data);
          if (!favorite) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Project not found' }));
            return;
          }
          res.end(JSON.stringify(favorite));
          return;
        }

        if (req.method === 'PATCH' && favoriteId) {
          const favorite = config.updateFavorite(projectId, favoriteId, data);
          if (!favorite) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Favorite not found' }));
            return;
          }
          res.end(JSON.stringify(favorite));
          return;
        }

        if (req.method === 'DELETE' && favoriteId) {
          const deleted = config.deleteFavorite(projectId, favoriteId);
          if (!deleted) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Favorite not found' }));
            return;
          }
          res.end(JSON.stringify({ success: true }));
          return;
        }

        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid favorites request' }));
        return;
      }

      if (pathname === '/api/projects' && req.method === 'POST') {
        const newProject = config.addProject(data.name, data.path);
        res.end(JSON.stringify(newProject));
      } else if (pathname === '/api/settings' && req.method === 'PATCH') {
        const settings = config.updateSettings(data);
        res.end(JSON.stringify(settings));
      } else if (
        pathname.startsWith('/api/projects/') &&
        req.method === 'PATCH'
      ) {
        const id = pathname.split('/').pop();
        const project = config.updateProject(id, data);
        if (project) {
          res.end(JSON.stringify(project));
        } else {
          res.statusCode = 404;
          res.end();
        }
      } else if (
        pathname.startsWith('/api/projects/') &&
        req.method === 'DELETE'
      ) {
        const id = pathname.split('/').pop();
        config.deleteProject(id);
        res.end(JSON.stringify({ success: true }));
      } else {
        res.statusCode = 404;
        res.end();
      }
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: e.message }));
    }
  });
};

/**
 * Handle project page requests
 */
const handleProjectRequest = (res, projectId, subPath, url) => {
  res.setHeader('Connection', 'close');

  const project = config.findProject(projectId);
  if (!project) return res.end(html('<h1>Project Not Found</h1>'));

  const fullPath = path.join(project.path, subPath);

  if (!isPathWithinProject(project.path, subPath)) {
    return res.end(html('<h1>Access Denied</h1>'));
  }

  if (!fs.existsSync(fullPath)) {
    return res.end(html('<h1>404 - Not Found</h1>', 'Not Found', projectId));
  }

  const stats = fs.statSync(fullPath);

  if (stats.isDirectory()) {
    const readmePath = path.join(fullPath, 'README.md');
    const showAll = url.searchParams.get('all') === 'true';

    if (fs.existsSync(readmePath) && !showAll) {
      const content = fs.readFileSync(readmePath, 'utf-8');
      const title = getH1Title(content) || 'README.md';
      const readmeFilePath =
        subPath === '/' ? 'README.md' : path.join(subPath, 'README.md');
      const nav = `<div class="back-link"><a href="javascript:history.back()">&larr; Back</a><span style="color:var(--border-color)">|</span><a href="?all=true">Show all files</a></div>`;
      res.end(
        html(
          renderMarkdown(content),
          title,
          projectId,
          nav,
          readmeFilePath,
          readmeFilePath,
        ),
      );
    } else {
      const files = getMarkdownFiles(
        fullPath,
        subPath === '/' ? '' : subPath,
        !showAll,
      );
      const list = files
        .sort()
        .map((f) => {
          const isFolder = f.endsWith('/');
          const name = isFolder
            ? f.slice(0, -1).split('/').pop()
            : path.basename(f);
          return `<li><a href="/p/${projectId}/${f}">${isFolder ? '📁' : '📄'} <span>${name}</span></a></li>`;
        })
        .join('');
      const nav = `<div class="back-link"><a href="javascript:history.back()">&larr; Back</a></div>`;
      res.end(
        html(
          `<h1>${path.basename(fullPath) || project.name}</h1><ul class="file-list">${list || '<li>No docs found</li>'}</ul>`,
          project.name,
          projectId,
          nav,
          null,
          subPath,
        ),
      );
    }
  } else if (fullPath.endsWith('.md')) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const title = getH1Title(content) || path.basename(fullPath);
    const nav = `<div class="back-link"><a href="javascript:history.back()">&larr; Back</a></div>`;
    res.end(
      html(renderMarkdown(content), title, projectId, nav, subPath, subPath),
    );
  } else {
    // Serve static files
    res.setHeader('Content-Type', getMimeType(fullPath));
    fs.createReadStream(fullPath).pipe(res);
  }
};

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  // SSE reload endpoint
  if (pathname === '/__reload') {
    handleReloadEndpoint(req, res, url);
    return;
  }

  // API endpoints
  if (pathname.startsWith('/api/')) {
    handleApiRequest(req, res, url, pathname);
    return;
  }

  // Dashboard
  if (pathname === '/') {
    res.setHeader('Connection', 'close');
    const projects = config.getProjects();
    res.end(
      html(
        `<h1>Mermaid Server</h1><p>Select a project from the sidebar.</p><ul class="file-list">${projects.map((p) => `<li><a href="/p/${p.id}/">📁 <span>${p.name}</span></a></li>`).join('')}</ul>`,
        'Mermaid Server',
        null,
        '',
      ),
    );
    return;
  }

  // Project pages
  const projectMatch = pathname.match(/^\/p\/([^/]+)(\/.*)?/);
  if (projectMatch) {
    const projectId = projectMatch[1];
    const subPath = decodeURIComponent(projectMatch[2] || '/');
    handleProjectRequest(res, projectId, subPath, url);
    return;
  }

  // 404
  res.setHeader('Connection', 'close');
  res.statusCode = 404;
  res.end(html('<h1>404 - Not Found</h1>'));
});

server.listen(PORT, () => {
  console.log(`\nMermaid Server running at http://localhost:${PORT}`);
  console.log(`Config: ${config.CONFIG_PATH}\n`);
});
