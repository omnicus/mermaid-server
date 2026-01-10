const http = require("http");
const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const PORT = process.env.PORT || 4000;
const DOCS_DIR = process.argv[2] || ".";

// Track connected clients for live reload
const clients = new Set();

// Custom extension to handle mermaid code blocks
const mermaidExtension = {
  name: "mermaid",
  level: "block",
  renderer(token) {
    if (token.type === "code" && token.lang === "mermaid") {
      return `<div class="mermaid">${token.text}</div>`;
    }
    return false;
  },
};

// Override the default code renderer
const renderer = {
  code(token) {
    if (token.lang === "mermaid") {
      return `<div class="mermaid">${token.text}</div>`;
    }
    // Default code block rendering
    const lang = token.lang ? ` class="language-${token.lang}"` : "";
    return `<pre><code${lang}>${token.text}</code></pre>`;
  },
};

marked.use({ renderer, gfm: true, breaks: true });

const html = (content, title = "Mermaid Server") => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({startOnLoad: true, theme: 'default'});</script>
  <style>
    body { 
      font-family: system-ui, -apple-system, sans-serif; 
      max-width: 900px; 
      margin: 2rem auto; 
      padding: 0 1rem;
      line-height: 1.6;
      color: #333;
    }
    .mermaid { 
      background: #fafafa; 
      padding: 1rem; 
      border-radius: 8px;
      margin: 1rem 0;
      overflow-x: auto;
      cursor: pointer;
      position: relative;
      transition: box-shadow 0.2s;
    }
    .mermaid:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .mermaid::after {
      content: 'Click to expand';
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 0.7rem;
      color: #888;
      background: white;
      padding: 2px 6px;
      border-radius: 3px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .mermaid:hover::after {
      opacity: 1;
    }
    
    /* Fullscreen modal */
    .diagram-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.8);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      padding: 2rem;
      box-sizing: border-box;
    }
    .diagram-modal.active {
      display: flex;
    }
    .diagram-modal-content {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      width: 90vw;
      max-height: 90vh;
      overflow: auto;
      position: relative;
    }
    .diagram-modal-content svg {
      width: 100% !important;
      height: auto !important;
      max-width: none !important;
    }
    .diagram-modal-close {
      position: absolute;
      top: 10px;
      right: 10px;
      background: #f44336;
      color: white;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.2rem;
      line-height: 1;
      z-index: 1001;
    }
    .diagram-modal-close:hover {
      background: #d32f2f;
    }
    .diagram-modal-hint {
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      color: #666;
      font-size: 0.8rem;
    }
    pre {
      background: #f4f4f4;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
    }
    code {
      background: #f4f4f4;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'SF Mono', Consolas, monospace;
    }
    pre code {
      background: none;
      padding: 0;
    }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    h1, h2, h3 { margin-top: 1.5rem; }
    .file-list { list-style: none; padding: 0; }
    .file-list li { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
    .file-list a { display: block; }
    .back-link { 
      margin-bottom: 1rem; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
    }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f4f4f4; }
    blockquote { border-left: 4px solid #ddd; margin: 1rem 0; padding-left: 1rem; color: #666; }
    img { max-width: 100%; }
    .reload-indicator {
      position: fixed;
      top: 10px;
      right: 10px;
      background: #4caf50;
      color: white;
      padding: 0.3rem 0.6rem;
      border-radius: 4px;
      font-size: 0.8rem;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .reload-indicator.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="reload-indicator" id="reload-indicator">Reloaded</div>
  ${content}
  <!-- Fullscreen modal for diagrams -->
  <div class="diagram-modal" id="diagram-modal">
    <button class="diagram-modal-close" id="modal-close">&times;</button>
    <div class="diagram-modal-content" id="modal-content"></div>
    <div class="diagram-modal-hint">Press ESC or click outside to close</div>
  </div>

  <script>
    // Live reload via Server-Sent Events
    let evtSource;

    function connectSSE() {
      if (evtSource) evtSource.close();

      evtSource = new EventSource('/__reload');

      evtSource.onmessage = (e) => {
        if (e.data === 'reload') {
          const indicator = document.getElementById('reload-indicator');
          indicator.classList.add('show');
          // Close connection immediately before reloading to free up socket
          evtSource.close();
          setTimeout(() => location.reload(), 300);
        }
      };

      evtSource.onerror = (e) => {
        // console.log('Live reload disconnected');
      };
    }

    connectSSE();

    // Explicitly close connection when navigating away
    window.addEventListener('beforeunload', () => {
      if (evtSource) {
        evtSource.close();
      }
    });

    // Fullscreen diagram modal
    const modal = document.getElementById('diagram-modal');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.getElementById('modal-close');

    function openModal(diagramHtml) {
      modalContent.innerHTML = diagramHtml;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Force SVG to use full width, auto height
      const svg = modalContent.querySelector('svg');
      if (svg) {
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = 'auto';
      }
    }

    function closeModal() {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Click on diagram to expand
    document.addEventListener('click', (e) => {
      const mermaidEl = e.target.closest('.mermaid');
      if (mermaidEl && !modal.classList.contains('active')) {
        openModal(mermaidEl.innerHTML);
      }
    });

    // Close modal
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>
`;

const renderMarkdown = (md) => {
  return marked(md);
};

const getH1Title = (md) => {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
};

const nav = (showAllLink = false, showBack = true, currentPath = "") => {
  let allLink = "";
  if (showAllLink) {
    const dirPath = currentPath.endsWith(".md") ? path.dirname(currentPath) : currentPath;
    const targetUrl = dirPath === "." || dirPath === "/" ? "/?all=true" : `${dirPath}/?all=true`;
    allLink = `<a href="${targetUrl}">Show all files in folder</a>`;
  }
  return `
    <div class="back-link">
      ${showBack ? `<a href="javascript:history.back()">&larr; Back</a>` : "<span></span>"}
      ${allLink}
    </div>
  `;
};

const getMarkdownFiles = (dir, prefix = "", recursive = true) => {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const fullPath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        files.push(...getMarkdownFiles(path.join(dir, entry.name), fullPath, true));
      } else {
        files.push(fullPath + "/");
      }
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  // Server-Sent Events endpoint for live reload
  if (pathname === "/__reload") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write("data: connected\n\n");

    // Heartbeat to keep connection alive and detect disconnects
    const heartbeat = setInterval(() => {
      if (res.writableEnded || res.finished) {
        clearInterval(heartbeat);
        return;
      }
      res.write(": ping\n\n");
    }, 15000);

    clients.add(res);

    const cleanup = () => {
      clients.delete(res);
      clearInterval(heartbeat);
    };

    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("error", (err) => {
      cleanup();
    });

    return;
  }

  const filePath = path.join(DOCS_DIR, pathname);
  const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  const isDir = stats && stats.isDirectory();

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Connection", "close");

  if (pathname === "/" || isDir) {
    const dirPath = isDir ? filePath : DOCS_DIR;
    const readmePath = path.join(dirPath, "README.md");
    const showAll = url.searchParams.get("all") === "true";
    const isRoot = pathname === "/";

    if (fs.existsSync(readmePath) && !showAll) {
      const content = fs.readFileSync(readmePath, "utf-8");
      const title = getH1Title(content) || "README.md";
      const rendered = `
        ${nav(true, !isRoot, pathname)}
        ${renderMarkdown(content)}
      `;
      res.end(html(rendered, title));
    } else {
      // List markdown files in current directory only when showAll is active or no README
      const files = getMarkdownFiles(dirPath, isDir ? pathname.slice(1) : "", !showAll);
      const folderName = isRoot ? "Root" : path.basename(dirPath);
      
      if (files.length === 0) {
        res.end(
          html(
            `${nav(false, !isRoot, pathname)}<h1>${folderName}</h1><p>No markdown files found in this directory.</p>`,
            folderName
          ),
        );
      } else {
        const list = files
          .sort()
          .map((f) => {
            const isFolder = f.endsWith("/");
            const name = isFolder ? f.slice(0, -1).split("/").pop() : path.basename(f);
            const label = isFolder ? `📁 ${name}` : `📄 ${name}`;
            return `<li><a href="/${f}">${label}</a></li>`;
          })
          .join("");
        res.end(
          html(
            `${nav(false, !isRoot, pathname)}<h1>${folderName}</h1><ul class="file-list">${list}</ul>`,
            folderName
          ),
        );
      }
    }
  } else if (pathname.endsWith(".md")) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const fileName = path.basename(filePath);
      const title = getH1Title(content) || fileName;
      const isReadme = fileName.toLowerCase() === "readme.md";
      const rendered = `
        ${nav(isReadme, true, pathname)}
        ${renderMarkdown(content)}
      `;
      res.end(html(rendered, title));
    } else {
      res.statusCode = 404;
      res.end(html(`${nav(false, true, pathname)}<h1>404 - File Not Found</h1>`, "404 - Not Found"));
    }
  } else {
    res.statusCode = 404;
    res.end(html(`${nav(false, true, pathname)}<h1>404 - Not Found</h1>`, "404 - Not Found"));
  }
});

// File watcher for live reload
const watchedFiles = new Set();
let debounceTimer;

const notifyClients = () => {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    console.log(
      `[${new Date().toLocaleTimeString()}] Notifying ${clients.size} clients of changes`,
    );
    for (const client of clients) {
      if (client.writable && !client.finished) {
        client.write("data: reload\n\n");
      }
    }
    debounceTimer = null;
  }, 100);
};

const setupWatcher = () => {
  const watchDir = (dir) => {
    if (watchedFiles.has(dir)) return;

    try {
      const watcher = fs.watch(
        dir,
        { recursive: true },
        (eventType, filename) => {
          if (filename && filename.endsWith(".md")) {
            console.log(
              `[${new Date().toLocaleTimeString()}] File changed: ${filename}`,
            );
            notifyClients();
          }
        },
      );

      watcher.on("error", (err) => {
        console.error("Watch error:", err.message);
      });

      watchedFiles.add(dir);
      console.log(`Watching for changes in: ${path.resolve(dir)}`);
    } catch (err) {
      console.error("Failed to setup watcher:", err.message);
    }
  };

  watchDir(DOCS_DIR);
};

server.listen(PORT, () => {
  console.log(`\nMermaid Server running at http://localhost:${PORT}`);
  console.log(`Serving files from: ${path.resolve(DOCS_DIR)}`);
  console.log("\nFeatures:");
  console.log("  - Markdown rendering with marked");
  console.log("  - Mermaid diagram support");
  console.log("  - Live reload on file changes (SSE)");
  console.log("\nPress Ctrl+C to stop\n");

  setupWatcher();
});
