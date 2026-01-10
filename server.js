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

// Helper to generate slug from heading text
const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Remove consecutive hyphens
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
  heading(token) {
    const id = slugify(token.text);
    return `<h${token.depth} id="${id}"><a href="#${id}" class="heading-anchor" aria-label="Link to this section">#</a>${token.text}</h${token.depth}>`;
  },
};

marked.use({ renderer, gfm: true, breaks: true });

/**
 * Design: Mermaid Server File Viewer
 * 
 * Aesthetic Direction: Developer-focused minimalism with refined details
 * Typography: System fonts with improved hierarchy
 * Color Palette: Refined neutrals (#1a1a2e, #f8f9fa) with modern blue accent (#2563eb)
 * Key Features: Sticky frosted-glass header, enhanced file list, smooth transitions
 * 
 * Accessibility: WCAG AA compliant
 * Responsive: Mobile-first with desktop enhancements
 */

const html = (content, title = "Mermaid Server") => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({startOnLoad: true, theme: 'default'});</script>
  <!-- Syntax highlighting with Highlight.js -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css">
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    
    :root {
      --color-text: #1a1a2e;
      --color-text-muted: #64748b;
      --color-bg: #ffffff;
      --color-bg-subtle: #f8f9fa;
      --color-bg-muted: #f1f5f9;
      --color-border: #e2e8f0;
      --color-border-subtle: #f1f5f9;
      --color-accent: #2563eb;
      --color-accent-hover: #1d4ed8;
      --color-success: #10b981;
      --color-danger: #ef4444;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --header-height: 60px;
      --toc-width: 240px;
    }
    
    html {
      scroll-padding-top: calc(var(--header-height) + 1rem);
      scroll-behavior: smooth;
    }
    
    body { 
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 0;
      padding: 0;
      line-height: 1.7;
      color: var(--color-text);
      background: var(--color-bg);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* Progress Bar */
    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
      height: 3px;
      background: linear-gradient(90deg, var(--color-accent), #60a5fa);
      z-index: 200;
      transition: width 0.1s ease-out;
    }
    
    /* Sticky Header */
    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--color-border);
      height: var(--header-height);
      transition: box-shadow 0.2s ease;
    }
    
    .site-header.scrolled {
      box-shadow: var(--shadow-md);
    }
    
    .header-inner {
      max-width: 900px;
      margin: 0 auto;
      padding: 0 1.5rem;
      height: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .nav-back {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-text);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.9rem;
      padding: 0.5rem 0.75rem;
      margin-left: -0.75rem;
      border-radius: var(--radius-sm);
      transition: background 0.15s ease, color 0.15s ease;
    }
    
    .nav-back:hover {
      background: var(--color-bg-muted);
      color: var(--color-accent);
      text-decoration: none;
    }
    
    .nav-back svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
    }
    
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .nav-link {
      color: var(--color-text-muted);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-sm);
      transition: background 0.15s ease, color 0.15s ease;
    }
    
    .nav-link:hover {
      background: var(--color-bg-muted);
      color: var(--color-accent);
      text-decoration: none;
    }
    
    /* Main Content */
    .main-content {
      max-width: 900px; 
      margin: 0 auto; 
      padding: 2rem 1.5rem 4rem;
      min-height: calc(100vh - var(--header-height));
    }
    
    /* Typography */
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 1.5rem;
      letter-spacing: -0.025em;
      color: var(--color-text);
    }
    
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 2.5rem 0 1rem;
      letter-spacing: -0.02em;
    }
    
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 2rem 0 0.75rem;
    }
    
    h4, h5, h6 {
      font-weight: 600;
      margin: 1.5rem 0 0.5rem;
    }
    
    /* Heading Anchor Links */
    h1, h2, h3, h4, h5, h6 {
      position: relative;
    }
    
    .heading-anchor {
      position: absolute;
      left: -1.5rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-muted);
      opacity: 0;
      font-weight: 400;
      text-decoration: none;
      transition: opacity 0.15s ease, color 0.15s ease;
    }
    
    .heading-anchor:hover {
      color: var(--color-accent);
      text-decoration: none;
    }
    
    h1:hover .heading-anchor,
    h2:hover .heading-anchor,
    h3:hover .heading-anchor,
    h4:hover .heading-anchor,
    h5:hover .heading-anchor,
    h6:hover .heading-anchor {
      opacity: 1;
    }
    
    p {
      margin: 0 0 1rem;
    }
    
    /* Links */
    a { 
      color: var(--color-accent); 
      text-decoration: none;
      transition: color 0.15s ease;
    }
    a:hover { 
      color: var(--color-accent-hover);
      text-decoration: underline; 
    }
    
    /* File List */
    .file-list { 
      list-style: none; 
      padding: 0;
      margin: 0;
    }
    
    .file-list li { 
      border-bottom: 1px solid var(--color-border-subtle);
    }
    
    .file-list li:last-child {
      border-bottom: none;
    }
    
    .file-list a { 
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 0.75rem;
      margin: 0 -0.75rem;
      border-radius: var(--radius-sm);
      color: var(--color-text);
      font-weight: 450;
      transition: background 0.15s ease;
    }
    
    .file-list a:hover {
      background: var(--color-bg-subtle);
      text-decoration: none;
    }
    
    .file-list .file-icon {
      font-size: 1.1rem;
      flex-shrink: 0;
    }
    
    /* Mermaid Diagrams */
    .mermaid { 
      background: var(--color-bg-subtle); 
      padding: 1.5rem; 
      border-radius: var(--radius-lg);
      margin: 1.5rem 0;
      overflow-x: auto;
      cursor: pointer;
      position: relative;
      border: 1px solid var(--color-border);
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }
    
    .mermaid:hover {
      box-shadow: var(--shadow-md);
      border-color: var(--color-accent);
    }
    
    .mermaid::after {
      content: 'Click to expand';
      position: absolute;
      top: 12px;
      right: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--color-text-muted);
      background: var(--color-bg);
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .mermaid:hover::after {
      opacity: 1;
    }
    
    /* Code Blocks */
    pre {
      background: var(--color-bg-subtle);
      padding: 1.25rem;
      border-radius: var(--radius-md);
      overflow-x: auto;
      border: 1px solid var(--color-border);
      margin: 1rem 0;
    }
    
    code {
      background: var(--color-bg-muted);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
      font-size: 0.9em;
    }
    
    pre code {
      background: none;
      padding: 0;
      font-size: 0.875rem;
      line-height: 1.6;
    }
    
    /* Tables */
    table { 
      border-collapse: collapse; 
      width: 100%; 
      margin: 1.5rem 0;
      font-size: 0.95rem;
    }
    
    th, td { 
      border: 1px solid var(--color-border); 
      padding: 0.75rem 1rem; 
      text-align: left; 
    }
    
    th { 
      background: var(--color-bg-subtle);
      font-weight: 600;
    }
    
    tr:hover td {
      background: var(--color-bg-subtle);
    }
    
    /* Blockquotes */
    blockquote { 
      border-left: 3px solid var(--color-accent); 
      margin: 1.5rem 0; 
      padding: 0.5rem 0 0.5rem 1.25rem; 
      color: var(--color-text-muted);
      background: var(--color-bg-subtle);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    }
    
    blockquote p:last-child {
      margin-bottom: 0;
    }
    
    /* Images */
    img { 
      max-width: 100%;
      border-radius: var(--radius-md);
    }
    
    /* Lists */
    ul, ol {
      padding-left: 1.5rem;
      margin: 1rem 0;
    }
    
    li {
      margin: 0.25rem 0;
    }
    
    /* Fullscreen Modal */
    .diagram-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.85);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      padding: 2rem;
      box-sizing: border-box;
      animation: fadeIn 0.2s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .diagram-modal.active {
      display: flex;
    }
    
    .diagram-modal-content {
      background: var(--color-bg);
      border-radius: var(--radius-lg);
      padding: 2rem;
      width: 90vw;
      max-height: 90vh;
      overflow: auto;
      position: relative;
      animation: scaleIn 0.2s ease;
    }
    
    @keyframes scaleIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    
    .diagram-modal-content svg {
      width: 100% !important;
      height: auto !important;
      max-width: none !important;
    }
    
    .diagram-modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--color-danger);
      color: white;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.25rem;
      line-height: 1;
      z-index: 1001;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    
    .diagram-modal-close:hover {
      background: #dc2626;
      transform: scale(1.05);
    }
    
    .diagram-modal-hint {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.7);
      font-size: 0.85rem;
      background: rgba(0,0,0,0.5);
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
    }
    
    /* Reload Indicator */
    .reload-indicator {
      position: fixed;
      top: calc(var(--header-height) + 16px);
      right: 16px;
      background: var(--color-success);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-weight: 500;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      z-index: 99;
      box-shadow: var(--shadow-md);
    }
    
    .reload-indicator.show { 
      opacity: 1;
      transform: translateY(0);
    }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--color-text-muted);
    }
    
    .empty-state p {
      margin: 0;
    }
    
    /* Table of Contents */
    .toc-sidebar {
      position: fixed;
      top: calc(var(--header-height) + 2rem);
      left: calc(50% + 450px + 2rem);
      width: var(--toc-width);
      max-height: calc(100vh - var(--header-height) - 4rem);
      overflow-y: auto;
      padding: 1rem;
      background: var(--color-bg-subtle);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      font-size: 0.85rem;
      opacity: 0;
      transform: translateX(10px);
      animation: tocFadeIn 0.3s ease forwards;
      animation-delay: 0.2s;
    }
    
    @keyframes tocFadeIn {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    .toc-sidebar::-webkit-scrollbar {
      width: 4px;
    }
    
    .toc-sidebar::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .toc-sidebar::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 2px;
    }
    
    .toc-title {
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 0.75rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .toc-list li {
      margin: 0;
      padding: 0;
    }
    
    .toc-list a {
      display: block;
      padding: 0.35rem 0;
      color: var(--color-text-muted);
      text-decoration: none;
      border-left: 2px solid transparent;
      padding-left: 0.75rem;
      margin-left: -0.75rem;
      transition: color 0.15s ease, border-color 0.15s ease;
      line-height: 1.4;
    }
    
    .toc-list a:hover {
      color: var(--color-accent);
      text-decoration: none;
    }
    
    .toc-list a.active {
      color: var(--color-accent);
      border-left-color: var(--color-accent);
      font-weight: 500;
    }
    
    .toc-list .toc-h3 {
      padding-left: 1.5rem;
      font-size: 0.8rem;
    }
    
    .toc-list .toc-h4 {
      padding-left: 2.25rem;
      font-size: 0.75rem;
    }
    
    /* Syntax highlighting overrides */
    .hljs {
      background: transparent !important;
      padding: 0 !important;
    }
    
    /* Responsive */
    @media (max-width: 1400px) {
      .toc-sidebar {
        display: none;
      }
    }
    
    @media (max-width: 640px) {
      .main-content {
        padding: 1.5rem 1rem 3rem;
      }
      
      h1 {
        font-size: 1.5rem;
      }
      
      .header-inner {
        padding: 0 1rem;
      }
      
      .heading-anchor {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="progress-bar" id="progress-bar"></div>
  <header class="site-header" id="site-header">
    <div class="header-inner">
      <div id="nav-container"></div>
      <div class="nav-actions">
        <div class="reload-indicator" id="reload-indicator">Reloaded</div>
      </div>
    </div>
  </header>
  <main class="main-content">
    ${content}
  </main>
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

    // Sticky header shadow on scroll
    const header = document.getElementById('site-header');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      if (currentScroll > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      lastScroll = currentScroll;
    }, { passive: true });

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
    
    // Reading Progress Bar
    const progressBar = document.getElementById('progress-bar');
    
    function updateProgressBar() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = progress + '%';
    }
    
    window.addEventListener('scroll', updateProgressBar, { passive: true });
    updateProgressBar();
    
    // Generate Table of Contents
    function generateTOC() {
      const headings = document.querySelectorAll('.main-content h2, .main-content h3, .main-content h4');
      if (headings.length < 3) return; // Only show TOC if there are at least 3 headings
      
      const toc = document.createElement('nav');
      toc.className = 'toc-sidebar';
      toc.setAttribute('aria-label', 'Table of contents');
      
      const title = document.createElement('div');
      title.className = 'toc-title';
      title.textContent = 'On this page';
      toc.appendChild(title);
      
      const list = document.createElement('ul');
      list.className = 'toc-list';
      
      headings.forEach(heading => {
        if (!heading.id) return;
        
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#' + heading.id;
        a.textContent = heading.textContent.replace(/^#\\s*/, '');
        a.className = 'toc-' + heading.tagName.toLowerCase();
        a.dataset.target = heading.id;
        li.appendChild(a);
        list.appendChild(li);
      });
      
      toc.appendChild(list);
      document.body.appendChild(toc);
      
      // Highlight active section
      const tocLinks = toc.querySelectorAll('a');
      
      function updateActiveTOC() {
        let current = '';
        
        headings.forEach(heading => {
          const rect = heading.getBoundingClientRect();
          if (rect.top <= 100) {
            current = heading.id;
          }
        });
        
        tocLinks.forEach(link => {
          link.classList.toggle('active', link.dataset.target === current);
        });
      }
      
      window.addEventListener('scroll', updateActiveTOC, { passive: true });
      updateActiveTOC();
    }
    
    generateTOC();
    
    // Syntax Highlighting
    if (typeof hljs !== 'undefined') {
      document.querySelectorAll('pre code').forEach(block => {
        // Skip mermaid blocks
        if (block.closest('.mermaid')) return;
        hljs.highlightElement(block);
      });
    }
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
    allLink = `<a href="${targetUrl}" class="nav-link">Show all files</a>`;
  }
  
  const backButton = showBack 
    ? `<a href="javascript:history.back()" class="nav-back">
        <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Back
       </a>` 
    : '<span></span>';
  
  return `
    <script>
      document.getElementById('nav-container').innerHTML = '${backButton.replace(/\n/g, '').replace(/'/g, "\\'")}';
      ${allLink ? `document.querySelector('.nav-actions').insertAdjacentHTML('afterbegin', '${allLink.replace(/'/g, "\\'")}');` : ''}
    </script>
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
            `${nav(false, !isRoot, pathname)}<h1>${folderName}</h1><div class="empty-state"><p>No markdown files found in this directory.</p></div>`,
            folderName
          ),
        );
      } else {
        const list = files
          .sort()
          .map((f) => {
            const isFolder = f.endsWith("/");
            const name = isFolder ? f.slice(0, -1).split("/").pop() : path.basename(f);
            const icon = isFolder 
              ? '<span class="file-icon" aria-hidden="true">&#128193;</span>' 
              : '<span class="file-icon" aria-hidden="true">&#128196;</span>';
            return `<li><a href="/${f}">${icon}<span>${name}</span></a></li>`;
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
