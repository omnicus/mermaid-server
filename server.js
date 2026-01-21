/**
 * Mermaid Server
 * 
 * A local Node.js server to render Markdown files with Mermaid diagrams.
 * Supports multiple projects, live reload, and persistent configuration.
 */

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

const escapeHtml = (text) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const renderer = {
  code(token) {
    if (token.lang === "mermaid") {
      return `<div class="mermaid">${token.text}</div>`;
    }
    const lang = token.lang ? ` class="language-${token.lang}"` : "";
    const codeId = crypto.randomBytes(4).toString("hex");
    const escapedCode = escapeHtml(token.text);
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-block-lang">${token.lang || "text"}</span>
          <button class="copy-button" onclick="copyCode('${codeId}')">Copy</button>
        </div>
        <pre><code id="code-${codeId}"${lang}>${escapedCode}</code></pre>
      </div>`;
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

  // Create back-button logic that skips anchor jumps
  const backButtonHtml = `<a href="javascript:void(0)" onclick="goBack()" class="back-button">&larr; Back</a>`;
  const refinedNav = nav.replace(/<a href="javascript:history\.back\(\)">&larr; Back<\/a>/, backButtonHtml);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({startOnLoad: true, theme: 'default'});</script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css">
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
  <style>
    :root {
      --sidebar-width: 280px;
      --bg-color: #ffffff;
      --sidebar-bg: #f9fafb;
      --border-color: #e5e7eb;
      --primary-color: #6366f1;
      --primary-hover: #4f46e5;
      --text-main: #111827;
      --text-secondary: #4b5563;
      --text-muted: #9ca3af;
      --code-bg: #1f2937;
      --radius-sm: 6px;
      --radius-md: 10px;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --font-sans: ui-sans-serif, system-ui, -apple-system, sans-serif;
      --font-mono: ui-monospace, 'JetBrains Mono', 'SF Mono', monospace;
    }

    * { box-sizing: border-box; }
    
    body { 
      font-family: var(--font-sans); 
      margin: 0;
      padding: 0;
      display: flex;
      height: 100vh;
      color: var(--text-main);
      background: var(--bg-color);
      overflow: hidden;
      line-height: 1.6;
    }
    
    /* Sidebar */
    #sidebar {
      width: var(--sidebar-width);
      flex-shrink: 0;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
    }
    #sidebar.hidden {
      margin-left: calc(-1 * var(--sidebar-width));
    }
    .sidebar-header {
      padding: 1.5rem 1rem;
      padding-left: 4.5rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 64px;
    }
    .sidebar-header h2 { 
      margin: 0; 
      font-size: 0.875rem; 
      text-transform: uppercase; 
      letter-spacing: 0.05em; 
      color: var(--text-secondary);
      font-weight: 600;
    }
    
    .project-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem 0.5rem;
    }
    .project-item {
      display: flex;
      align-items: center;
      padding: 0.625rem 0.75rem;
      gap: 0.5rem;
      cursor: pointer;
      border-radius: var(--radius-sm);
      margin-bottom: 2px;
      transition: all 0.2s;
    }
    .project-item:hover { background: #f3f4f6; }
    .project-item.active { 
      background: #eef2ff; 
      color: var(--primary-color);
    }
    .project-item.active .project-name { font-weight: 600; }
    
    .project-link { 
      flex: 1; 
      text-decoration: none; 
      color: inherit; 
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.9375rem;
    }
    .project-actions {
      display: none;
      gap: 4px;
    }
    .project-item:hover .project-actions { display: flex; }
    .project-actions button {
      background: white;
      border: 1px solid var(--border-color);
      cursor: pointer;
      padding: 4px;
      color: var(--text-secondary);
      border-radius: 4px;
      line-height: 1;
      font-size: 0.875rem;
      box-shadow: var(--shadow-sm);
    }
    .project-actions button:hover { border-color: var(--primary-color); color: var(--primary-color); }

    .sidebar-footer {
      padding: 1rem;
      border-top: 1px solid var(--border-color);
    }
    .btn-add {
      width: 100%;
      padding: 0.625rem;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-weight: 500;
      font-size: 0.875rem;
      transition: background 0.2s;
    }
    .btn-add:hover { background: var(--primary-hover); }

    /* Main Content */
    #main {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      position: relative;
      scroll-behavior: smooth;
    }
    .container {
      max-width: 720px;           /* ~65-70 characters per line at 18px */
      margin: 0 auto;
      padding: 0 2rem;
    }
    
    .content-header {
      position: sticky;
      top: 0;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(12px);
      z-index: 100;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border-color);
    }
    .header-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .progress-bar {
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 0%;
      height: 2px;
      background: var(--primary-color);
      transition: width 0.1s;
    }

    #sidebar-toggle {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 2000;
      background: #fff;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      width: 36px;
      height: 36px;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    #sidebar-toggle:hover {
      border-color: var(--primary-color);
      color: var(--primary-color);
    }

    .back-link { 
      display: flex; 
      align-items: center; 
      gap: 1.5rem; 
    }
    .back-link a {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .back-link a:hover { color: var(--primary-color); }

    .file-list { list-style: none; padding: 0; margin: 1rem 0; }
    .file-list li { margin-bottom: 0.5rem; }
    .file-list a { 
      display: flex; 
      align-items: center; 
      gap: 0.75rem; 
      padding: 0.75rem 1rem; 
      color: var(--text-main); 
      text-decoration: none;
      background: #f9fafb;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      transition: all 0.2s;
    }
    .file-list a:hover { 
      border-color: var(--primary-color);
      background: #f5f7ff;
      color: var(--primary-color);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    /* Content Styling - Optimized for Reading */
    .content-body {
      padding: 3rem 0;
      font-size: 1.125rem;        /* 18px - optimal for long-form reading */
      line-height: 1.7;           /* Improved readability */
      letter-spacing: -0.01em;    /* Slightly tighter for body text */
    }
    h1, h2, h3, h4, h5, h6 {
      scroll-margin-top: 5rem;    /* Account for sticky header */
    }
    h1 { 
      font-size: 2.5rem;          /* 40px */
      font-weight: 800; 
      margin-bottom: 1.5rem; 
      letter-spacing: -0.03em; 
      line-height: 1.2;
    }
    h2 { 
      font-size: 1.75rem;         /* 28px - clear hierarchy */
      font-weight: 700; 
      margin: 3rem 0 1.25rem;     /* More breathing room above */
      padding-bottom: 0.5rem; 
      border-bottom: 1px solid var(--border-color); 
      line-height: 1.3;
      letter-spacing: -0.02em;
    }
    h3 { 
      font-size: 1.375rem;        /* 22px */
      font-weight: 600; 
      margin: 2.5rem 0 1rem; 
      line-height: 1.4;
      letter-spacing: -0.01em;
    }
    h4 {
      font-size: 1.125rem;        /* 18px */
      font-weight: 600;
      margin: 2rem 0 0.75rem;
      line-height: 1.4;
    }
    p { 
      margin-bottom: 1.5rem;      /* More space between paragraphs */
      color: #374151; 
    }
    
    /* List styling for better readability */
    ul, ol {
      margin: 1.5rem 0;
      padding-left: 1.5rem;
    }
    li {
      margin-bottom: 0.5rem;
      line-height: 1.7;
    }
    li > ul, li > ol {
      margin: 0.5rem 0;
    }

    /* Code & Mermaid */
    .mermaid { 
      background: #fdfdfd; 
      padding: 2rem; 
      border-radius: var(--radius-md);
      margin: 2rem 0;
      overflow-x: auto;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid var(--border-color);
      display: flex;
      justify-content: center;
    }
    .mermaid:hover { border-color: var(--primary-color); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

    .code-block-wrapper {
      margin: 1.5rem -3rem;       /* Extend beyond container */
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--code-bg);
      border: 1px solid #374151;
    }
    
    @media (max-width: 800px) {
      .code-block-wrapper {
        margin-left: -1.5rem;
        margin-right: -1.5rem;
        border-radius: 0;
      }
    }
    .code-block-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1rem;
      background: #111827;
      border-bottom: 1px solid #374151;
    }
    .code-block-lang { color: #9ca3af; font-size: 0.75rem; font-family: var(--font-mono); font-weight: 600; text-transform: uppercase; }
    .copy-button {
      background: #374151;
      border: none;
      color: #e5e7eb;
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .copy-button:hover { background: var(--primary-color); color: white; }
    pre { margin: 0; padding: 1.25rem; overflow-x: auto; font-family: var(--font-mono); font-size: 0.9rem; }
    code { font-family: var(--font-mono); background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.85em; }
    pre code { background: none; padding: 0; font-size: inherit; color: #e5e7eb; }
    
    /* Markdown Elements */
    table { border-collapse: collapse; width: 100%; margin: 2rem 0; font-size: 0.9rem; }
    th, td { border: 1px solid var(--border-color); padding: 0.75rem 1rem; text-align: left; }
    th { background: #f9fafb; font-weight: 600; color: var(--text-secondary); }
    blockquote { 
      border-left: 4px solid var(--primary-color); 
      margin: 2rem 0; 
      padding: 1rem 1.5rem; 
      color: var(--text-secondary); 
      background: #f5f7ff; 
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      font-size: 1.0625rem;       /* Slightly smaller than body */
      line-height: 1.65;
    }
    blockquote p:last-child {
      margin-bottom: 0;
    }
    img { max-width: 100%; height: auto; border-radius: var(--radius-sm); border: 1px solid var(--border-color); }
    
    .reload-indicator {
      position: fixed; top: 16px; right: 16px;
      background: #10b981; color: white;
      padding: 0.5rem 1rem; border-radius: 20px;
      font-size: 0.75rem; font-weight: 600; opacity: 0; transition: all 0.3s;
      z-index: 2000; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      transform: translateY(-10px);
    }
    .reload-indicator.show { opacity: 1; transform: translateY(0); }

    .heading-anchor {
      position: absolute;
      left: -1.75rem;
      color: var(--text-muted);
      opacity: 0;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    h1:hover .heading-anchor, h2:hover .heading-anchor, h3:hover .heading-anchor { opacity: 1; }

    .toc-sidebar {
      position: fixed;
      top: 6rem;
      right: 2rem;
      width: 280px;
      max-height: calc(100vh - 8rem);
      overflow-y: auto;
      padding: 0 1rem;
      font-size: 0.875rem;
    }
    
    /* Ensure content doesn't overlap with TOC */
    #main .container {
      margin-right: auto;
      margin-left: auto;
    }
    
    @media (min-width: 1400px) {
      #main .container {
        margin-left: calc(50% - 360px - 140px); /* Shift left to make room for TOC */
        margin-right: calc(50% - 360px + 140px);
      }
    }
    .toc-title { font-weight: 700; margin-bottom: 1rem; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; }
    .toc-list { list-style: none; padding: 0; margin: 0; border-left: 1px solid var(--border-color); }
    .toc-list a {
      display: block;
      padding: 0.375rem 0 0.375rem 1rem;
      color: var(--text-secondary);
      text-decoration: none;
      margin-left: -1px;
      border-left: 2px solid transparent;
      transition: all 0.2s;
    }
    .toc-list a:hover { color: var(--primary-color); }
    .toc-list a.active { color: var(--primary-color); border-left-color: var(--primary-color); font-weight: 500; }
    .toc-list a.toc-h3 { padding-left: 2rem; font-size: 0.8125rem; }

    @media (max-width: 1200px) { .toc-sidebar { display: none; } }
    
    @media (max-width: 1200px) {
      #main .container {
        margin-left: auto;
        margin-right: auto;
      }
    }

    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.4);
      backdrop-filter: blur(4px);
      z-index: 4000;
      justify-content: center; align-items: center;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: white; padding: 2rem; border-radius: var(--radius-md);
      width: 480px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
    }
    .form-group { margin-bottom: 1.25rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.875rem; }
    .form-group input { width: 100%; padding: 0.625rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-family: inherit; }
    .form-group input:focus { outline: none; border-color: var(--primary-color); ring: 2px solid #eef2ff; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 2rem; }
    .btn { padding: 0.625rem 1.25rem; border: 1px solid transparent; border-radius: var(--radius-sm); cursor: pointer; font-weight: 500; font-size: 0.875rem; }
    .btn-primary { background: var(--primary-color); color: white; }
    .btn-secondary { background: white; border-color: var(--border-color); color: var(--text-secondary); }
    .btn:hover { opacity: 0.9; }

    .browser-container {
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      max-height: 240px;
      overflow-y: auto;
      margin-top: 0.5rem;
      background: #fdfdfd;
    }
    .browser-item {
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      border-bottom: 1px solid #f3f4f6;
    }
    .browser-item:hover { background: #f3f4f6; color: var(--primary-color); }
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

  <button id="sidebar-toggle" onclick="toggleSidebar()" title="Toggle Sidebar">
    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7"></path></svg>
  </button>

  <main id="main">
    <header class="content-header">
      <div class="container">
        <div class="header-nav">
          <div class="back-link">${refinedNav || '<span style="font-weight:600; font-size:0.875rem; color:#9ca3af;">DASHBOARD</span>'}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;" id="scroll-status">0% READ</div>
        </div>
      </div>
      <div class="progress-bar" id="progress-bar"></div>
    </header>
    <div class="container">
      <div class="content-body">
        <div class="reload-indicator" id="reload-indicator">Changes Detected • Reloading</div>
        ${content}
      </div>
    </div>
  </main>

  <div class="diagram-modal" id="diagram-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:3000; justify-content:center; align-items:center; padding:2rem; box-sizing:border-box;">
    <button id="modal-close" style="position:absolute; top:10px; right:10px; background:#f44336; color:white; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:1.2rem; z-index:3001;">&times;</button>
    <div id="modal-content" style="background:white; border-radius:var(--radius-md); padding:2rem; width:90vw; max-height:90vh; overflow:auto; position:relative;"></div>
  </div>

  <div class="modal-overlay" id="project-modal">
    <div class="modal">
      <h3 style="margin-top:0;">Project Configuration</h3>
      <input type="hidden" id="project-id">
      <div class="form-group">
        <label for="project-name-input">Project Name</label>
        <input type="text" id="project-name-input" placeholder="e.g. API Documentation">
      </div>
      <div class="form-group">
        <label for="project-path-input">Absolute Path</label>
        <div style="display: flex; gap: 0.5rem;">
          <input type="text" id="project-path-input" placeholder="/Users/dev/project" style="flex: 1;">
          <button class="btn btn-secondary" onclick="toggleBrowser()" style="padding: 0 1rem;">Browse</button>
        </div>
        <div id="file-browser" class="browser-container" style="display: none;"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="hideProjectModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveProject()">Save Project</button>
      </div>
    </div>
  </div>

  <script>
    const projectId = ${projectId ? `'${projectId}'` : 'null'};
    const mainEl = document.getElementById('main');
    let evtSource = null;
    
    // Track page navigations (excluding hash changes) using sessionStorage
    const NAV_HISTORY_KEY = 'mermaid_nav_history';
    
    function getNavHistory() {
      try {
        return JSON.parse(sessionStorage.getItem(NAV_HISTORY_KEY)) || [];
      } catch { return []; }
    }
    
    function saveNavHistory(history) {
      sessionStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(history));
    }
    
    // Record current page on load (pathname + search, excluding hash)
    (function recordPageVisit() {
      const currentPage = window.location.pathname + window.location.search;
      const history = getNavHistory();
      
      // Only add if different from the last entry (avoid duplicates from hash nav)
      if (history.length === 0 || history[history.length - 1] !== currentPage) {
        history.push(currentPage);
        // Keep only last 50 entries
        if (history.length > 50) history.shift();
        saveNavHistory(history);
      }
    })();
    
    // Custom Back function that ignores anchor jumps and navigates to previous page
    function goBack() {
      // Close SSE connection before navigating
      if (typeof evtSource !== 'undefined' && evtSource) {
        evtSource.close();
      }
      
      const history = getNavHistory();
      const currentPage = window.location.pathname + window.location.search;
      
      // Remove current page from history
      while (history.length > 0 && history[history.length - 1] === currentPage) {
        history.pop();
      }
      
      if (history.length > 0) {
        const previousPage = history[history.length - 1];
        // Don't remove it yet - let the next page load handle that
        saveNavHistory(history);
        window.location.href = previousPage;
      } else {
        // No history, go to project root or home
        if (projectId) {
          window.location.href = '/p/' + projectId + '/';
        } else {
          window.location.href = '/';
        }
      }
    }

    function copyCode(id) {
      const code = document.getElementById('code-' + id).innerText;
      navigator.clipboard.writeText(code);
      const btn = event.target;
      const original = btn.innerText;
      btn.innerText = 'Copied!';
      btn.style.background = '#10b981';
      setTimeout(() => { btn.innerText = original; btn.style.background = ''; }, 2000);
    }

    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('hidden');
      fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sidebarSticky: !sidebar.classList.contains('hidden') })
      });
    }

    function showAddProject() {
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
      if (name && name !== currentName) await updateProject(id, { name });
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
      if (res.ok) location.href = '/';
    }

    async function saveProject() {
      const id = document.getElementById('project-id').value;
      const name = document.getElementById('project-name-input').value;
      const path = document.getElementById('project-path-input').value;
      if (!name || !path) return alert('Name and Path are required');
      const res = await fetch('/api/projects' + (id ? '/' + id : ''), {
        method: id ? 'PATCH' : 'POST',
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
    }

    if (projectId) {
      function connectSSE() {
        if (evtSource) {
          evtSource.close();
          evtSource = null;
        }
        
        evtSource = new EventSource('/__reload?projectId=' + projectId);
        
        evtSource.onmessage = (e) => {
          if (e.data === 'reload') {
            document.getElementById('reload-indicator').classList.add('show');
            evtSource.close();
            evtSource = null;
            setTimeout(() => location.reload(), 500);
          }
        };
        
        evtSource.onerror = () => {
          // Connection lost, close and don't reconnect automatically
          if (evtSource) {
            evtSource.close();
            evtSource = null;
          }
        };
      }
      
      connectSSE();
      
      // Close connection when navigating away
      window.addEventListener('beforeunload', () => {
        if (evtSource) {
          evtSource.close();
          evtSource = null;
        }
      });
      
      // Also close on pagehide (for bfcache)
      window.addEventListener('pagehide', () => {
        if (evtSource) {
          evtSource.close();
          evtSource = null;
        }
      });
    }

    const modal = document.getElementById('diagram-modal');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.getElementById('modal-close');
    function openModal(diagramHtml) {
      modalContent.innerHTML = diagramHtml;
      modal.style.display = 'flex';
      const svg = modalContent.querySelector('svg');
      if (svg) {
        svg.removeAttribute('width'); svg.removeAttribute('height');
        svg.style.width = '100%'; svg.style.height = 'auto';
      }
    }
    document.addEventListener('click', (e) => {
      const mermaid = e.target.closest('.mermaid');
      if (mermaid) openModal(mermaid.innerHTML);
    });
    modalClose.onclick = () => { modal.style.display = 'none'; };
    modal.onclick = (e) => { if (e.target === modal) modalClose.onclick(); };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (modal.style.display === 'flex') modalClose.onclick();
        hideProjectModal();
      }
    });

    function generateTOC() {
      const headings = document.querySelectorAll('.content-body h2, .content-body h3');
      if (headings.length < 2) return;
      const toc = document.createElement('nav');
      toc.className = 'toc-sidebar';
      toc.innerHTML = '<div class="toc-title">On this page</div><ul class="toc-list"></ul>';
      const list = toc.querySelector('ul');
      headings.forEach(h => {
        const a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = h.textContent.replace(/^#/, '');
        a.dataset.target = h.id;
        if (h.tagName === 'H3') a.classList.add('toc-h3');
        const li = document.createElement('li');
        li.appendChild(a);
        list.appendChild(li);
      });
      document.body.appendChild(toc);
      const tocLinks = toc.querySelectorAll('a');
      mainEl.addEventListener('scroll', () => {
        let current = '';
        headings.forEach(h => { if (h.getBoundingClientRect().top <= 100) current = h.id; });
        tocLinks.forEach(link => link.classList.toggle('active', link.dataset.target === current));
      }, { passive: true });
    }

    mainEl.addEventListener('scroll', () => {
      const st = mainEl.scrollTop;
      const sh = mainEl.scrollHeight - mainEl.clientHeight;
      const percent = sh > 0 ? (st / sh) * 100 : 0;
      document.getElementById('progress-bar').style.width = percent + '%';
      document.getElementById('scroll-status').innerText = Math.round(percent) + '% READ';
    }, { passive: true });

    generateTOC();
    hljs.highlightAll();
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
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
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
    res.on("close", cleanup);
    res.on("error", cleanup);
    return;
  }
  if (pathname.startsWith("/api/")) {
    res.setHeader("Connection", "close");
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
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const data = body ? JSON.parse(body) : {};
        if (pathname === "/api/projects" && req.method === "POST") {
          const newProject = { 
            id: crypto.randomBytes(4).toString("hex"), 
            name: data.name, 
            path: path.resolve(data.path) 
          };
          config.projects.push(newProject); 
          saveConfig(); 
          res.end(JSON.stringify(newProject));
        } else if (pathname === "/api/settings" && req.method === "PATCH") {
          config.settings = { ...config.settings, ...data }; 
          saveConfig(); 
          res.end(JSON.stringify(config.settings));
        } else if (pathname.startsWith("/api/projects/") && req.method === "PATCH") {
          const id = pathname.split("/").pop();
          const p = config.projects.find(p => p.id === id);
          if (p) { 
            Object.assign(p, data); 
            if (data.path) p.path = path.resolve(data.path); 
            saveConfig(); 
            res.end(JSON.stringify(p)); 
          } else { 
            res.statusCode = 404; 
            res.end(); 
          }
        } else if (pathname.startsWith("/api/projects/") && req.method === "DELETE") {
          config.projects = config.projects.filter(p => p.id !== pathname.split("/").pop());
          saveConfig(); 
          res.end(JSON.stringify({ success: true }));
        } else { 
          res.statusCode = 404; 
          res.end(); 
        }
      } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }
  if (pathname === "/") {
    res.setHeader("Connection", "close");
    res.end(html(`<h1>Mermaid Server</h1><p>Select a project from the sidebar.</p><ul class="file-list">${config.projects.map(p => `<li><a href="/p/${p.id}/">📁 <span>${p.name}</span></a></li>`).join("")}</ul>`, "Mermaid Server", null, ""));
    return;
  }
  const projectMatch = pathname.match(/^\/p\/([^/]+)(\/.*)?/);
  if (projectMatch) {
    res.setHeader("Connection", "close");
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
        const nav = `<div class="back-link"><a href="javascript:history.back()">&larr; Back</a><span style="color:var(--border-color)">|</span><a href="?all=true">Show all files</a></div>`;
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
  } else { 
    res.setHeader("Connection", "close");
    res.statusCode = 404; 
    res.end(html("<h1>404 - Not Found</h1>")); 
  }
});

server.listen(PORT, () => {
  console.log(`\nMermaid Server running at http://localhost:${PORT}`);
  console.log(`Config: ${CONFIG_PATH}\n`);
});
