/**
 * Markdown rendering and HTML template generation for Mermaid Server
 */

const crypto = require('crypto');
const { marked } = require('marked');
const { getProjects, getSettings } = require('./config');

/**
 * Convert text to URL-friendly slug
 */
const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Remove consecutive hyphens
};

/**
 * Escape HTML special characters
 */
const escapeHtml = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Custom marked renderer for mermaid code blocks and headings
 */
const renderer = {
  code(token) {
    if (token.lang === 'mermaid') {
      return `<div class="mermaid">${token.text}</div>`;
    }
    const lang = token.lang ? ` class="language-${token.lang}"` : '';
    const codeId = crypto.randomBytes(4).toString('hex');
    const escapedCode = escapeHtml(token.text);
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-block-lang">${token.lang || 'text'}</span>
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

// Configure marked with custom renderer
marked.use({ renderer, gfm: true, breaks: true });

/**
 * Extract H1 title from markdown content
 */
const getH1Title = (md) => {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
};

/**
 * Render markdown to HTML
 */
const renderMarkdown = (content) => {
  return marked(content);
};

/**
 * Generate the full HTML page template
 */
const html = (
  content,
  title = 'Mermaid Server',
  projectId = null,
  nav = '',
  filePath = null,
  favoritePath = null,
) => {
  const projects = getProjects();
  const settings = getSettings();
  const activeProject = projects.find((project) => project.id === projectId);
  const projectFavorites = activeProject?.favorites || [];
  
  const projectListHtml = projects
    .map((project) => {
      const favorites = project.favorites || [];
      const favoritesHtml = favorites.length
        ? `
        <div class="favorite-group">
          <div class="favorite-header">Favorites</div>
          <div class="favorite-list">
            ${favorites
              .map((favorite) => {
                const favoritePath = favorite.path ? `/${favorite.path}` : '/';
                const safeName = JSON.stringify(favorite.name);
                return `
                <div class="favorite-item" data-id="${favorite.id}">
                  <a href="/p/${project.id}${favoritePath}" class="favorite-link" title="${favorite.path || '/'}">
                    <span class="favorite-icon">★</span>
                    <span class="favorite-name">${favorite.name}</span>
                  </a>
                  <div class="favorite-actions">
                    <button onclick='renameFavorite("${project.id}", "${favorite.id}", ${safeName})' title="Rename">✎</button>
                    <button onclick='deleteFavorite("${project.id}", "${favorite.id}")' title="Remove">×</button>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
        `
        : '';

      return `
      <div class="project-section">
        <div class="project-item ${project.id === projectId ? 'active' : ''}" data-id="${project.id}">
          <a href="/p/${project.id}/" class="project-link">
            <span class="project-name" title="${project.path}">${project.name}</span>
          </a>
          <div class="project-actions">
            <button onclick="renameProject('${project.id}', '${project.name}')" title="Rename">✎</button>
            <button onclick="deleteProject('${project.id}')" title="Remove">×</button>
          </div>
        </div>
        ${favoritesHtml}
      </div>
    `;
    })
    .join('');

  // Create back-button logic that skips anchor jumps
  const backButtonHtml = `<a href="javascript:void(0)" onclick="goBack()" class="back-button">&larr; Back</a>`;
  const refinedNav = nav.replace(
    /<a href="javascript:history\.back\(\)">&larr; Back<\/a>/,
    backButtonHtml,
  );

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif'
    });
  </script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
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

    .project-section {
      margin-bottom: 0.75rem;
    }
    .favorite-group {
      margin-left: 0.75rem;
      margin-top: 0.35rem;
      border-left: 2px solid #eef2ff;
      padding-left: 0.5rem;
    }
    .favorite-header {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin: 0.35rem 0 0.4rem;
      font-weight: 600;
    }
    .favorite-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .favorite-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.5rem;
      border-radius: var(--radius-sm);
      transition: all 0.2s;
    }
    .favorite-item:hover { background: #f3f4f6; }
    .favorite-link {
      flex: 1;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: var(--text-main);
      font-size: 0.875rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .favorite-icon {
      color: #f59e0b;
      font-size: 0.75rem;
    }
    .favorite-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease;
    }
    .favorite-item:hover .favorite-actions {
      opacity: 1;
      visibility: visible;
    }
    .favorite-actions button {
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
    .favorite-actions button:hover { border-color: var(--primary-color); color: var(--primary-color); }

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
      position: relative;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .header-actions .scroll-status {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 500;
      min-width: 4.5rem;
      text-align: right;
    }

    .search-trigger {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      background: var(--sidebar-bg);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      font-size: 0.8125rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .search-trigger:hover {
      border-color: var(--primary-color);
      color: var(--text-secondary);
      background: white;
    }
    .search-trigger svg {
      flex-shrink: 0;
    }
    .search-trigger-text {
      font-weight: 500;
    }
    .search-trigger-shortcut {
      font-family: var(--font-mono);
      font-size: 0.6875rem;
      background: white;
      border: 1px solid var(--border-color);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      color: var(--text-muted);
    }
    @media (max-width: 600px) {
      .search-trigger-text,
      .search-trigger-shortcut {
        display: none;
      }
      .search-trigger {
        padding: 0.375rem;
      }
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
    .mermaid svg {
      max-width: 100%;
      height: auto;
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
      position: fixed; top: 60px; right: 16px;
      background: #10b981; color: white;
      padding: 0.5rem 1rem; border-radius: 20px;
      font-size: 0.75rem; font-weight: 600; opacity: 0; transition: all 0.3s;
      z-index: 2000; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      transform: translateY(-10px);
    }
    .reload-indicator.show { opacity: 1; transform: translateY(0); }

    .page-actions {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2100;
      display: flex;
      align-items: center;
      gap: 8px;
      opacity: 0.45;
      transition: opacity 0.2s;
    }
    .page-actions:hover {
      opacity: 1;
    }
    .page-actions.copied {
      opacity: 1;
    }
    .page-action-button {
      height: 36px;
      width: 36px;
      border-radius: 999px;
      border: 1px solid var(--border-color);
      background: rgba(255, 255, 255, 0.9);
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s, background 0.2s;
      box-shadow: var(--shadow-sm);
    }
    .page-action-button:hover {
      border-color: var(--primary-color);
      color: var(--primary-color);
      background: white;
    }
    .page-action-button.copied {
      border-color: #10b981;
      color: #10b981;
    }
    .page-action-button.is-favorite {
      border-color: #f59e0b;
      color: #f59e0b;
      background: #fffbeb;
    }
    .page-action-button.is-favorite svg {
      fill: currentColor;
    }
    .copy-page-dropdown {
      display: flex;
      align-items: center;
      position: relative;
    }
    .copy-page-dropdown .page-action-button {
      border-radius: 999px 0 0 999px;
      border-right: none;
    }
    .copy-page-toggle {
      height: 36px;
      padding: 0 8px;
      border-radius: 0 999px 999px 0;
      border: 1px solid var(--border-color);
      background: rgba(255, 255, 255, 0.9);
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s;
      box-shadow: var(--shadow-sm);
      font-size: 0.6rem;
    }
    .copy-page-toggle:hover {
      border-color: var(--primary-color);
      color: var(--primary-color);
    }
    .copy-page-menu {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: white;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      overflow: hidden;
      min-width: 160px;
    }
    .copy-page-menu.show { display: block; }
    .copy-page-menu button {
      display: block;
      width: 100%;
      padding: 10px 16px;
      background: none;
      border: none;
      text-align: left;
      font-size: 0.875rem;
      color: var(--text-main);
      cursor: pointer;
      transition: background 0.15s;
    }
    .copy-page-menu button:hover {
      background: #f3f4f6;
      color: var(--primary-color);
    }
    .copy-page-menu button + button {
      border-top: 1px solid var(--border-color);
    }

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

/* Edit Mode */
    .edit-mode {
      display: none;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    body.editing #view-mode { display: none; }
    body.editing .edit-mode { display: flex; }
    body.editing .content-header { display: none; }
    body.editing .page-actions { display: none; }
    body.editing .toc-sidebar { display: none; }
    body.editing #main { padding: 0; overflow: hidden; }
    .editor-panes {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .editor-pane-editor {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #fafafa;
    }
    .editor-pane-preview {
      flex: 1;
      overflow-y: auto;
      border-left: 1px solid var(--border-color);
      background: white;
    }
    .editor-textarea {
      flex: 1;
      border: none;
      padding: 1.5rem;
      font-family: var(--font-mono);
      font-size: 0.9375rem;
      line-height: 1.6;
      resize: none;
      outline: none;
      background: #fafafa;
      color: #1a1a1a;
      tab-size: 2;
    }
    .editor-textarea:focus {
      background: #fff;
    }
    .editor-textarea::placeholder {
      color: #999;
    }
    .editor-preview {
      padding: 2rem;
      max-width: 720px;
      margin: 0 auto;
    }
    .editor-preview h1 { font-size: 1.75rem; margin-top: 0; }
    .editor-preview h2 { font-size: 1.375rem; margin-top: 2rem; }
    .editor-preview h3 { font-size: 1.125rem; }
    .editor-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--border-color);
      background: #f5f5f5;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .editor-status { display: flex; align-items: center; gap: 0.5rem; }
    .editor-status.saving { color: var(--primary-color); }
    .editor-status.saved { color: #10b981; }
    .editor-status.error { color: #ef4444; }
    @media (max-width: 900px) {
      .editor-pane-preview { display: none; }
      body.editing.show-preview .editor-pane-editor { display: none; }
      body.editing.show-preview .editor-pane-preview { display: block; }
    }
    .editor-modal.active { display: flex; }
    .editor-container {
      background: white;
      width: 90vw;
      height: 90vh;
      max-width: 1200px;
      border-radius: var(--radius-md);
      box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
      background: var(--sidebar-bg);
    }
    .editor-title {
      font-weight: 600;
      font-size: 0.9375rem;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .editor-title svg { color: var(--text-muted); }
    .editor-actions {
      display: flex;
      gap: 0.75rem;
    }
    .editor-toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0.5rem 1rem;
      background: #f5f5f5;
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
    }
    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .toolbar-divider {
      width: 1px;
      height: 24px;
      background: var(--border-color);
      margin: 0 6px;
    }
    .toolbar-spacer {
      flex: 1;
    }
    .editor-toolbar button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 600;
      transition: all 0.15s;
    }
    .editor-toolbar button:hover {
      background: white;
      color: var(--primary-color);
      box-shadow: var(--shadow-sm);
    }
    .editor-toolbar button:active {
      transform: scale(0.95);
    }
    .toolbar-btn-text {
      width: auto !important;
      padding: 0 12px !important;
      color: var(--text-secondary) !important;
    }
    .toolbar-btn-text:hover {
      color: var(--text-main) !important;
      background: white !important;
    }
    .toolbar-btn-primary {
      width: auto !important;
      padding: 0 16px !important;
      background: var(--primary-color) !important;
      color: white !important;
    }
    .toolbar-btn-primary:hover {
      background: var(--primary-hover) !important;
    }
    .editor-body {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .editor-textarea {
      flex: 1;
      border: none;
      padding: 1.5rem;
      font-family: var(--font-mono);
      font-size: 0.9375rem;
      line-height: 1.6;
      resize: none;
      outline: none;
      background: #fafafa;
    }
    .editor-textarea:focus {
      background: white;
    }
    .editor-preview {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      border-left: 1px solid var(--border-color);
      background: white;
    }
    .editor-preview h1 { font-size: 1.75rem; margin-top: 0; }
    .editor-preview h2 { font-size: 1.375rem; }
    .editor-preview h3 { font-size: 1.125rem; }
    .editor-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1.5rem;
      border-top: 1px solid var(--border-color);
      background: var(--sidebar-bg);
      font-size: 0.8125rem;
      color: var(--text-muted);
    }
    .editor-status { display: flex; align-items: center; gap: 0.5rem; }
    .editor-status.saving { color: var(--primary-color); }
    .editor-status.saved { color: #10b981; }
    .editor-status.error { color: #ef4444; }
    .btn-edit {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      background: white;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-edit:hover {
      border-color: var(--primary-color);
      color: var(--primary-color);
    }
    .editor-toggle-preview {
      display: none;
      padding: 0.375rem 0.75rem;
      background: #f3f4f6;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 0.75rem;
      cursor: pointer;
    }
    .editor-toggle-preview.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
    @media (max-width: 900px) {
      .editor-preview { display: none; }
      .editor-preview.mobile-visible { display: block; position: absolute; left: 0; right: 0; top: 60px; bottom: 50px; z-index: 10; }
      .editor-toggle-preview { display: inline-block; }
    }

    /* Search Modal (Command Palette) */
    .search-modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 5000;
      justify-content: center;
      align-items: flex-start;
      padding-top: 15vh;
    }
    .search-modal-overlay.active {
      display: flex;
    }
    .search-modal {
      background: white;
      border-radius: var(--radius-md);
      width: 560px;
      max-width: 90vw;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    .search-input-wrapper {
      display: flex;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border-color);
      gap: 0.75rem;
    }
    .search-input-wrapper svg {
      color: var(--text-muted);
      flex-shrink: 0;
    }
    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 1.0625rem;
      font-family: var(--font-sans);
      color: var(--text-main);
      background: transparent;
    }
    .search-input::placeholder {
      color: var(--text-muted);
    }
    .search-shortcut {
      font-size: 0.75rem;
      color: var(--text-muted);
      background: var(--sidebar-bg);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      font-family: var(--font-mono);
    }
    .search-results {
      max-height: 400px;
      overflow-y: auto;
    }
    .search-results-empty {
      padding: 2rem 1.25rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9375rem;
    }
    .search-results-loading {
      padding: 2rem 1.25rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9375rem;
    }
    .search-result-item {
      display: flex;
      align-items: flex-start;
      padding: 0.75rem 1.25rem;
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
      gap: 0.75rem;
      transition: background 0.15s;
    }
    .search-result-item:last-child {
      border-bottom: none;
    }
    .search-result-item:hover,
    .search-result-item.selected {
      background: #f5f7ff;
    }
    .search-result-item.selected {
      background: #eef2ff;
    }
    .search-result-icon {
      color: var(--text-muted);
      flex-shrink: 0;
      margin-top: 2px;
    }
    .search-result-content {
      flex: 1;
      min-width: 0;
    }
    .search-result-title {
      font-weight: 500;
      color: var(--text-main);
      font-size: 0.9375rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .search-result-path {
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin-top: 0.125rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .search-result-snippet {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .search-result-snippet mark {
      background: #fef08a;
      color: inherit;
      padding: 0 2px;
      border-radius: 2px;
    }
    .search-result-type {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      background: var(--sidebar-bg);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .search-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 1.25rem;
      background: var(--sidebar-bg);
      border-top: 1px solid var(--border-color);
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .search-footer-hints {
      display: flex;
      gap: 1rem;
    }
    .search-footer-hint {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .search-footer-hint kbd {
      background: white;
      border: 1px solid var(--border-color);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-family: var(--font-mono);
      font-size: 0.6875rem;
    }
  </style>
</head>
<body>
  <aside id="sidebar" class="${settings.sidebarSticky ? '' : 'hidden'}">
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
          <button class="search-trigger" onclick="openSearch()" title="Search (⌘K)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <span class="search-trigger-text">Search</span>
            <kbd class="search-trigger-shortcut">⌘K</kbd>
          </button>
          <div class="header-actions">
            <span class="scroll-status" id="scroll-status">0% READ</span>
          </div>
        </div>
      </div>
      <div class="progress-bar" id="progress-bar"></div>
    </header>
    <div class="page-actions" id="page-actions">
      ${projectId && favoritePath !== null ? `<button id="favorite-page-button" class="page-action-button" onclick="toggleFavorite()" title="Add favorite" aria-label="Add favorite">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </button>` : ''}
      ${filePath ? `<button id="edit-page-button" class="page-action-button" onclick="openEditor()" title="Edit this file" aria-label="Edit this file">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>` : ''}
      <div class="copy-page-dropdown" id="copy-page-dropdown">
        <button id="copy-page-button" class="page-action-button" title="Copy document" aria-label="Copy document">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="copy-page-toggle" id="copy-page-toggle" title="Copy options" aria-label="Copy options">&#9662;</button>
        <div class="copy-page-menu" id="copy-page-menu">
          <button onclick="copyPageAs('default')">Copy (Default)</button>
          <button onclick="copyPageAs('text')">Copy as Text</button>
          <button onclick="copyPageAs('html')">Copy as HTML</button>
          <button onclick="copyPageAs('markdown')">Copy as Markdown</button>
        </div>
      </div>
    </div>
    <div class="container" id="view-mode">
      <div class="content-body">
        <div class="reload-indicator" id="reload-indicator">Changes Detected • Reloading</div>
        ${content}
      </div>
    </div>
    ${filePath ? `<div class="edit-mode" id="edit-mode">
      <div class="editor-toolbar" id="editor-toolbar">
        <div class="toolbar-group">
          <button type="button" onclick="insertHeading(1)" title="Heading 1">H1</button>
          <button type="button" onclick="insertHeading(2)" title="Heading 2">H2</button>
          <button type="button" onclick="insertHeading(3)" title="Heading 3">H3</button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button type="button" onclick="insertFormat('bold')" title="Bold (Ctrl+B)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg></button>
          <button type="button" onclick="insertFormat('italic')" title="Italic (Ctrl+I)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg></button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button type="button" onclick="insertFormat('link')" title="Link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></button>
          <button type="button" onclick="insertFormat('image')" title="Image"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button type="button" onclick="insertFormat('bullet')" title="Bullet List"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg></button>
          <button type="button" onclick="insertFormat('numbered')" title="Numbered List"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg></button>
          <button type="button" onclick="insertFormat('blockquote')" title="Blockquote"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"></path></svg></button>
        </div>
        <div class="toolbar-divider"></div>
        <div class="toolbar-group">
          <button type="button" onclick="insertFormat('code')" title="Code Block"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></button>
          <button type="button" onclick="insertFormat('mermaid')" title="Mermaid Diagram"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"></path><path d="M3 12h18"></path><circle cx="12" cy="6" r="2"></circle><circle cx="6" cy="12" r="2"></circle><circle cx="18" cy="12" r="2"></circle><circle cx="12" cy="18" r="2"></circle></svg></button>
          <button type="button" onclick="insertFormat('table')" title="Table"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg></button>
          <button type="button" onclick="insertFormat('hr')" title="Horizontal Rule"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line></svg></button>
        </div>
        <div class="toolbar-spacer"></div>
        <div class="toolbar-group">
          <button type="button" class="toolbar-btn-text" onclick="closeEditor()">Cancel</button>
          <button type="button" class="toolbar-btn-primary" onclick="saveFile()">Save</button>
        </div>
      </div>
      <div class="editor-panes">
        <div class="editor-pane-editor">
          <textarea class="editor-textarea" id="editor-textarea" placeholder="Write your markdown here..."></textarea>
        </div>
        <div class="editor-pane-preview">
          <div class="editor-preview" id="editor-preview"></div>
        </div>
      </div>
      <div class="editor-footer">
        <div class="editor-status" id="editor-status">
          <span>Press Ctrl+S to save</span>
        </div>
        <div>
          <span id="editor-line-count">0 lines</span>
        </div>
      </div>
    </div>` : ''}
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

  <div class="search-modal-overlay" id="search-modal">
    <div class="search-modal">
      <div class="search-input-wrapper">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.3-4.3"></path>
        </svg>
        <input type="text" class="search-input" id="search-input" placeholder="Search docs..." autocomplete="off" spellcheck="false">
        <span class="search-shortcut">ESC</span>
      </div>
      <div class="search-results" id="search-results">
        <div class="search-results-empty" id="search-empty">
          Type to search for files and content
        </div>
      </div>
      <div class="search-footer">
        <div class="search-footer-hints">
          <span class="search-footer-hint"><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span class="search-footer-hint"><kbd>↵</kbd> Open</span>
          <span class="search-footer-hint"><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    const projectId = ${projectId ? `'${projectId}'` : 'null'};
    const filePath = ${filePath ? `'${filePath}'` : 'null'};
    const favoritePath = ${favoritePath ? JSON.stringify(favoritePath) : 'null'};
    const favorites = ${projectId ? JSON.stringify(projectFavorites) : '[]'};
    const pageTitle = ${JSON.stringify(title)};
    const mainEl = document.getElementById('main');
    const copyButton = document.getElementById('copy-page-button');
    const favoriteButton = document.getElementById('favorite-page-button');
    let evtSource = null;
    let editorDirty = false;
    
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

    function getSvgDimensions(svg) {
      let width = parseFloat(svg.getAttribute('width'));
      let height = parseFloat(svg.getAttribute('height'));
      if ((!width || !height) && svg.viewBox && svg.viewBox.baseVal) {
        width = svg.viewBox.baseVal.width;
        height = svg.viewBox.baseVal.height;
      }
      if (!width || !height) {
        const bbox = svg.getBBox();
        width = bbox.width;
        height = bbox.height;
      }
      return { width: Math.ceil(width || 0), height: Math.ceil(height || 0) };
    }

    async function svgToPngDataUrl(svg) {
      const { width, height } = getSvgDimensions(svg);
      if (!width || !height) return null;
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svg);
      if (!svgString.includes('xmlns=')) {
        svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      try {
        const img = new Image();
        img.decoding = 'async';
        const loaded = new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load failed'));
        });
        img.src = url;
        await loaded;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/png');
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    function buildCopyHtml(bodyHtml) {
      const styles = [
        'body {'
        + 'font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;'
        + 'color: #111827;'
        + 'line-height: 1.7;'
        + 'font-size: 12pt;'
        + '}',
        'h1 { font-size: 2.2rem; margin: 1.5rem 0 1rem; }',
        'h2 { font-size: 1.6rem; margin: 2rem 0 1rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.4rem; }',
        'h3 { font-size: 1.3rem; margin: 1.75rem 0 0.75rem; }',
        'p { margin: 0 0 1rem; }',
        'ul, ol { padding-left: 1.5rem; margin: 1rem 0; }',
        'li { margin: 0.4rem 0; }',
        'table { border-collapse: collapse; width: 100%; margin: 1.5rem 0; }',
        'th, td { border: 1px solid #e5e7eb; padding: 0.6rem 0.8rem; text-align: left; }',
        'th { background: #f9fafb; font-weight: 600; color: #4b5563; }',
        'blockquote {'
        + 'border-left: 4px solid #6366f1;'
        + 'margin: 1.5rem 0;'
        + 'padding: 0.8rem 1.2rem;'
        + 'background: #f5f7ff;'
        + 'color: #4b5563;'
        + 'border-radius: 0 6px 6px 0;'
        + '}',
        'img { max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #e5e7eb; }',
        '.code-block-wrapper {'
        + 'margin: 1.5rem 0;'
        + 'border-radius: 10px;'
        + 'overflow: hidden;'
        + 'background: transparent !important;'
        + 'border: 1px solid #374151;'
        + '}',
        '.code-block-header { display: none; }',
        'pre {'
        + 'margin: 0;'
        + 'padding: 1.25rem;'
        + 'overflow-x: auto;'
        + 'font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;'
        + 'font-size: 0.9rem;'
        + 'color: #e5e7eb;'
        + 'background: #1f2937;'
        + '}',
        'pre code { background: none; padding: 0; color: inherit; }',
        'code {'
        + 'font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;'
        + 'background: transparent !important;'
        + 'padding: 0.2rem 0.4rem;'
        + 'border-radius: 4px;'
        + 'font-size: 0.9em;'
        + '}'
      ].join('');
      return '<!doctype html><html><head><meta charset="utf-8"><style>'
        + styles
        + '</style></head><body>'
        + bodyHtml
        + '</body></html>';
    }

    function toggleCopyPageMenu(e) {
      e.stopPropagation();
      const menu = document.getElementById('copy-page-menu');
      menu.classList.toggle('show');
    }

    document.addEventListener('click', (e) => {
      const menu = document.getElementById('copy-page-menu');
      const toggle = document.getElementById('copy-page-toggle');
      if (menu && toggle && !toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('show');
      }
    });

    function htmlToMarkdown(element) {
      let md = '';
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          md += node.textContent;
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName.toLowerCase();
        switch (tag) {
          case 'h1': md += '# '; node.childNodes.forEach(walk); md += '\\n\\n'; break;
          case 'h2': md += '## '; node.childNodes.forEach(walk); md += '\\n\\n'; break;
          case 'h3': md += '### '; node.childNodes.forEach(walk); md += '\\n\\n'; break;
          case 'h4': md += '#### '; node.childNodes.forEach(walk); md += '\\n\\n'; break;
          case 'h5': md += '##### '; node.childNodes.forEach(walk); md += '\\n\\n'; break;
          case 'h6': md += '###### '; node.childNodes.forEach(walk); md += '\\n\\n'; break;
          case 'p': node.childNodes.forEach(walk); md += '\\n\\n'; break;
          case 'br': md += '\\n'; break;
          case 'strong': case 'b': md += '**'; node.childNodes.forEach(walk); md += '**'; break;
          case 'em': case 'i': md += '*'; node.childNodes.forEach(walk); md += '*'; break;
          case 'code':
            if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
              node.childNodes.forEach(walk);
            } else {
              md += '\`'; node.childNodes.forEach(walk); md += '\`';
            }
            break;
          case 'pre':
            const codeEl = node.querySelector('code');
            const lang = codeEl ? (codeEl.className.match(/language-(\\w+)/)?.[1] || '') : '';
            md += '\`\`\`' + lang + '\\n';
            node.childNodes.forEach(walk);
            md += '\\n\`\`\`\\n\\n';
            break;
          case 'a':
            md += '['; node.childNodes.forEach(walk); md += '](' + (node.getAttribute('href') || '') + ')';
            break;
          case 'img':
            md += '![' + (node.getAttribute('alt') || '') + '](' + (node.getAttribute('src') || '') + ')';
            break;
          case 'ul': case 'ol':
            const isOrdered = tag === 'ol';
            let idx = 1;
            node.querySelectorAll(':scope > li').forEach(li => {
              md += (isOrdered ? (idx++ + '. ') : '- ');
              li.childNodes.forEach(walk);
              md += '\\n';
            });
            md += '\\n';
            break;
          case 'li': break; // handled by ul/ol
          case 'blockquote':
            const lines = [];
            node.childNodes.forEach(walk);
            break;
          case 'hr': md += '---\\n\\n'; break;
          case 'div':
            if (node.classList.contains('mermaid')) {
              md += '\`\`\`mermaid\\n' + node.textContent.trim() + '\\n\`\`\`\\n\\n';
            } else {
              node.childNodes.forEach(walk);
            }
            break;
          default: node.childNodes.forEach(walk); break;
        }
      };
      element.childNodes.forEach(walk);
      return md.replace(/\\n{3,}/g, '\\n\\n').trim();
    }

    async function copyPageAs(format) {
      const menu = document.getElementById('copy-page-menu');
      menu.classList.remove('show');

      const content = document.querySelector('.content-body');
      if (!content) return;
      const clone = content.cloneNode(true);
      clone.querySelectorAll('.code-block-header').forEach(el => el.remove());
      clone.querySelectorAll('.copy-button').forEach(el => el.remove());
      clone.querySelectorAll('.heading-anchor').forEach(el => el.remove());
      clone.querySelectorAll('.reload-indicator').forEach(el => el.remove());

      // For default and html formats, convert mermaid SVGs to PNGs
      if (format === 'default' || format === 'html') {
        const sourceMermaids = Array.from(content.querySelectorAll('.mermaid'));
        const cloneMermaids = Array.from(clone.querySelectorAll('.mermaid'));
        for (let i = 0; i < sourceMermaids.length; i += 1) {
          const svg = sourceMermaids[i].querySelector('svg');
          const cloneNode = cloneMermaids[i];
          if (!svg || !cloneNode) continue;
          try {
            const pngUrl = await svgToPngDataUrl(svg);
            if (!pngUrl) continue;
            const img = document.createElement('img');
            img.src = pngUrl;
            img.alt = 'Mermaid diagram';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
            img.style.margin = '0 auto';
            cloneNode.replaceWith(img);
          } catch (err) {
            continue;
          }
        }
      }

      const htmlContent = buildCopyHtml(clone.innerHTML);
      const textContent = clone.innerText;

      try {
        if (format === 'default') {
          // Copy both HTML and plain text (original behavior)
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([htmlContent], { type: 'text/html' }),
              'text/plain': new Blob([textContent], { type: 'text/plain' })
            })
          ]);
        } else if (format === 'html') {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([htmlContent], { type: 'text/html' }),
              'text/plain': new Blob([textContent], { type: 'text/plain' })
            })
          ]);
        } else if (format === 'markdown') {
          await navigator.clipboard.writeText(htmlToMarkdown(clone));
        } else {
          // text
          await navigator.clipboard.writeText(textContent);
        }
      } catch (err) {
        await navigator.clipboard.writeText(textContent);
      }

      showCopyFeedback();
    }

    function showCopyFeedback() {
      if (!copyButton) return;
      const pageActions = document.getElementById('page-actions');
      const originalIcon = copyButton.innerHTML;
      copyButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      copyButton.classList.add('copied');
      if (pageActions) pageActions.classList.add('copied');
      copyButton.title = 'Copied!';
      setTimeout(() => {
        copyButton.innerHTML = originalIcon;
        copyButton.classList.remove('copied');
        if (pageActions) pageActions.classList.remove('copied');
        copyButton.title = 'Copy document';
      }, 2000);
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

    function normalizeFavoritePath(pathname) {
      if (!pathname || pathname === '/') return '';
      return pathname.replace(/^\\/+/, '').replace(/\\/+$/, '');
    }

    function getCurrentFavorite() {
      if (!favoritePath) return null;
      const currentPath = normalizeFavoritePath(favoritePath);
      return favorites.find((favorite) => normalizeFavoritePath(favorite.path) === currentPath);
    }

    function updateFavoriteButton() {
      if (!favoriteButton) return;
      const currentFavorite = getCurrentFavorite();
      favoriteButton.classList.toggle('is-favorite', !!currentFavorite);
      favoriteButton.setAttribute('aria-pressed', currentFavorite ? 'true' : 'false');
      favoriteButton.title = currentFavorite ? 'Remove favorite' : 'Add favorite';
    }

    async function toggleFavorite() {
      if (!projectId || favoritePath === null) return;
      const currentFavorite = getCurrentFavorite();
      if (currentFavorite) {
        await removeFavorite(projectId, currentFavorite.id);
      } else {
        await addFavorite(projectId);
      }
    }

    async function addFavorite(id) {
      const payload = {
        name: pageTitle || 'Untitled',
        path: normalizeFavoritePath(favoritePath),
      };
      const res = await fetch('/api/projects/' + id + '/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) location.reload();
    }

    async function renameFavorite(projectId, favoriteId, currentName) {
      const name = prompt('Rename favorite to:', currentName);
      if (name && name !== currentName) {
        const res = await fetch(
          '/api/projects/' + projectId + '/favorites/' + favoriteId,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          },
        );
        if (res.ok) location.reload();
      }
    }

    async function removeFavorite(projectId, favoriteId) {
      const res = await fetch(
        '/api/projects/' + projectId + '/favorites/' + favoriteId,
        { method: 'DELETE' },
      );
      if (res.ok) location.reload();
    }

    async function deleteFavorite(projectId, favoriteId) {
      if (!confirm('Remove this favorite?')) return;
      await removeFavorite(projectId, favoriteId);
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
    if (copyButton) copyButton.addEventListener('click', () => copyPageAs('default'));
    const copyToggle = document.getElementById('copy-page-toggle');
    if (copyToggle) copyToggle.addEventListener('click', toggleCopyPageMenu);
    updateFavoriteButton();

    // Editor functionality
    const editorTextarea = document.getElementById('editor-textarea');
    const editorPreview = document.getElementById('editor-preview');
    const editorStatus = document.getElementById('editor-status');
    const editorLineCount = document.getElementById('editor-line-count');
    let previewDebounce = null;
    let isEditing = false;

    async function openEditor() {
      if (!projectId || !filePath) return;
      if (!editorStatus) return;
      editorStatus.className = 'editor-status';
      editorStatus.innerHTML = '<span>Loading...</span>';
      document.body.classList.add('editing');
      isEditing = true;
      try {
        const res = await fetch('/api/file?projectId=' + projectId + '&path=' + encodeURIComponent(filePath));
        if (!res.ok) throw new Error('Failed to load file');
        const data = await res.json();
        editorTextarea.value = data.content;
        editorDirty = false;
        updateEditorPreview();
        updateLineCount();
        editorStatus.innerHTML = '<span>Press Ctrl+S to save</span>';
        // Set cursor to beginning and scroll to top
        editorTextarea.setSelectionRange(0, 0);
        editorTextarea.focus();
        editorTextarea.scrollTop = 0;
      } catch (e) {
        editorStatus.className = 'editor-status error';
        editorStatus.innerHTML = '<span>Error: ' + e.message + '</span>';
      }
    }

    function closeEditor() {
      if (editorDirty && !confirm('You have unsaved changes. Discard them?')) return;
      document.body.classList.remove('editing');
      document.body.classList.remove('show-preview');
      isEditing = false;
      editorDirty = false;
      // Reload to show updated content
      if (editorTextarea && editorTextarea.value) {
        location.reload();
      }
    }

    async function saveFile() {
      if (!projectId || !filePath) return;
      editorStatus.className = 'editor-status saving';
      editorStatus.innerHTML = '<span>Saving...</span>';
      try {
        const res = await fetch('/api/file?projectId=' + projectId + '&path=' + encodeURIComponent(filePath), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editorTextarea.value })
        });
        if (!res.ok) throw new Error('Failed to save file');
        editorDirty = false;
        editorStatus.className = 'editor-status saved';
        editorStatus.innerHTML = '<span>Saved successfully</span>';
        setTimeout(() => {
          if (!editorDirty) {
            editorStatus.className = 'editor-status';
            editorStatus.innerHTML = '<span>Press Ctrl+S to save</span>';
          }
        }, 2000);
      } catch (e) {
        editorStatus.className = 'editor-status error';
        editorStatus.innerHTML = '<span>Error: ' + e.message + '</span>';
      }
    }

    function updateEditorPreview() {
      // Simple markdown preview - marked library is loaded via CDN
      try {
        editorPreview.innerHTML = marked.parse(editorTextarea.value);
        // Re-render mermaid diagrams
        editorPreview.querySelectorAll('.mermaid').forEach((el, i) => {
          const code = el.textContent;
          el.removeAttribute('data-processed');
          el.innerHTML = code;
        });
        mermaid.init(undefined, editorPreview.querySelectorAll('.mermaid'));
        // Highlight code blocks
        editorPreview.querySelectorAll('pre code').forEach(block => {
          hljs.highlightElement(block);
        });
      } catch (e) {
        editorPreview.innerHTML = '<p style="color:#ef4444;">Preview error: ' + e.message + '</p>';
      }
    }

    function updateLineCount() {
      const lines = editorTextarea.value.split('\\n').length;
      editorLineCount.textContent = lines + ' line' + (lines !== 1 ? 's' : '');
    }

    function insertAtCursor(before, after = '', placeholder = '') {
      const scrollTop = editorTextarea.scrollTop;
      const start = editorTextarea.selectionStart;
      const end = editorTextarea.selectionEnd;
      const text = editorTextarea.value;
      const selectedText = text.substring(start, end) || placeholder;
      const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
      editorTextarea.value = newText;
      // Position cursor appropriately
      if (text.substring(start, end)) {
        // Had selection, move cursor to end
        editorTextarea.selectionStart = editorTextarea.selectionEnd = start + before.length + selectedText.length + after.length;
      } else {
        // No selection, select the placeholder
        editorTextarea.selectionStart = start + before.length;
        editorTextarea.selectionEnd = start + before.length + placeholder.length;
      }
      // Restore scroll position and focus
      editorTextarea.scrollTop = scrollTop;
      editorTextarea.focus();
      editorDirty = true;
      updateLineCount();
      if (previewDebounce) clearTimeout(previewDebounce);
      previewDebounce = setTimeout(updateEditorPreview, 300);
    }

    function insertHeading(level) {
      const scrollTop = editorTextarea.scrollTop;
      const prefix = '#'.repeat(level) + ' ';
      const start = editorTextarea.selectionStart;
      const text = editorTextarea.value;
      // Find start of current line
      let lineStart = start;
      while (lineStart > 0 && text[lineStart - 1] !== '\\n') lineStart--;
      // Check if line already has heading
      const lineEnd = text.indexOf('\\n', start);
      const line = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);
      const existingHeading = line.match(/^#{1,6}\\s*/);
      if (existingHeading) {
        // Replace existing heading level
        const newLine = prefix + line.substring(existingHeading[0].length);
        editorTextarea.value = text.substring(0, lineStart) + newLine + text.substring(lineEnd === -1 ? text.length : lineEnd);
      } else {
        // Insert heading prefix
        editorTextarea.value = text.substring(0, lineStart) + prefix + text.substring(lineStart);
      }
      // Restore scroll position and focus
      editorTextarea.scrollTop = scrollTop;
      editorTextarea.focus();
      editorDirty = true;
      updateLineCount();
      if (previewDebounce) clearTimeout(previewDebounce);
      previewDebounce = setTimeout(updateEditorPreview, 300);
    }

    function insertFormat(type) {
      switch (type) {
        case 'bold':
          insertAtCursor('**', '**', 'bold text');
          break;
        case 'italic':
          insertAtCursor('*', '*', 'italic text');
          break;
        case 'link':
          insertAtCursor('[', '](url)', 'link text');
          break;
        case 'image':
          insertAtCursor('![', '](image-url)', 'alt text');
          break;
        case 'code':
          insertAtCursor('\\n\`\`\`\\n', '\\n\`\`\`\\n', 'code here');
          break;
        case 'mermaid':
          insertAtCursor('\\n\`\`\`mermaid\\n', '\\n\`\`\`\\n', 'graph TD\\n    A[Start] --> B[End]');
          break;
        case 'bullet':
          insertAtCursor('\\n- ', '', 'List item');
          break;
        case 'numbered':
          insertAtCursor('\\n1. ', '', 'List item');
          break;
        case 'blockquote':
          insertAtCursor('\\n> ', '', 'Quote text');
          break;
        case 'table':
          insertAtCursor('\\n| Header 1 | Header 2 | Header 3 |\\n|----------|----------|----------|\\n| Cell 1   | Cell 2   | Cell 3   |\\n| Cell 4   | Cell 5   | Cell 6   |\\n', '', '');
          break;
        case 'hr':
          insertAtCursor('\\n---\\n', '', '');
          break;
      }
    }

    function toggleEditorPreview() {
      document.body.classList.toggle('show-preview');
    }

    if (editorTextarea) {
      editorTextarea.addEventListener('input', () => {
        editorDirty = true;
        updateLineCount();
        if (previewDebounce) clearTimeout(previewDebounce);
        previewDebounce = setTimeout(updateEditorPreview, 300);
      });
      // Handle Tab key for indentation
      editorTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = editorTextarea.selectionStart;
          const end = editorTextarea.selectionEnd;
          editorTextarea.value = editorTextarea.value.substring(0, start) + '  ' + editorTextarea.value.substring(end);
          editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 2;
          editorDirty = true;
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (isEditing) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeEditor();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          saveFile();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
          e.preventDefault();
          insertFormat('bold');
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
          e.preventDefault();
          insertFormat('italic');
        }
      }
    });

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (editorDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Search functionality (Command Palette)
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const searchEmpty = document.getElementById('search-empty');
    let searchDebounce = null;
    let searchSelectedIndex = -1;
    let currentSearchResults = [];

    function openSearch() {
      if (isEditing) return; // Don't open search while editing
      searchModal.classList.add('active');
      searchInput.value = '';
      searchInput.focus();
      searchResults.innerHTML = '';
      searchResults.appendChild(searchEmpty);
      searchEmpty.style.display = 'block';
      searchEmpty.textContent = 'Type to search for files and content';
      searchSelectedIndex = -1;
      currentSearchResults = [];
    }

    function closeSearch() {
      searchModal.classList.remove('active');
      searchInput.value = '';
      searchSelectedIndex = -1;
      currentSearchResults = [];
    }

    function highlightMatch(text, query) {
      if (!query) return text;
      // Split query into words and highlight each
      const words = query.trim().split(/\\s+/).filter(w => w.length > 0);
      let result = text;
      for (const word of words) {
        const escapedWord = word.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
        const regex = new RegExp('(' + escapedWord + ')', 'gi');
        result = result.replace(regex, '<mark>$1</mark>');
      }
      return result;
    }

    function renderSearchResults(results, query) {
      currentSearchResults = results;
      searchResults.innerHTML = '';
      
      if (results.length === 0) {
        searchEmpty.textContent = 'No results found for "' + query + '"';
        searchEmpty.style.display = 'block';
        searchResults.appendChild(searchEmpty);
        return;
      }

      searchEmpty.style.display = 'none';
      
      results.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'search-result-item' + (index === searchSelectedIndex ? ' selected' : '');
        item.dataset.index = index;
        
        // Different icons for different result types
        let icon;
        if (result.type === 'filename') {
          icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
        } else if (result.type === 'title') {
          icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="M21 12h-5"></path><path d="M21 6l-5 6 5 6"></path></svg>';
        } else {
          icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>';
        }
        
        const projectLabel = !projectId && result.projectName 
          ? '<span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 0.5rem;">' + result.projectName + '</span>' 
          : '';
        
        // Show snippet for title and content matches
        const snippetHtml = (result.type === 'content' || result.type === 'title') && result.snippet
          ? '<div class="search-result-snippet">' + highlightMatch(result.snippet, query) + '</div>'
          : '';
        
        // Type labels
        const typeLabels = { filename: 'File', title: 'Title', content: 'Content' };
        const typeLabel = typeLabels[result.type] || 'Match';
        
        item.innerHTML = 
          '<div class="search-result-icon">' + icon + '</div>' +
          '<div class="search-result-content">' +
            '<div class="search-result-title">' + highlightMatch(result.name, query) + projectLabel + '</div>' +
            '<div class="search-result-path">' + result.path + (result.line ? ':' + result.line : '') + '</div>' +
            snippetHtml +
          '</div>' +
          '<span class="search-result-type">' + typeLabel + '</span>';
        
        item.addEventListener('click', () => navigateToResult(result));
        item.addEventListener('mouseenter', () => {
          searchSelectedIndex = index;
          updateSelectedResult();
        });
        
        searchResults.appendChild(item);
      });
    }

    function updateSelectedResult() {
      const items = searchResults.querySelectorAll('.search-result-item');
      items.forEach((item, i) => {
        item.classList.toggle('selected', i === searchSelectedIndex);
      });
      // Scroll selected item into view
      if (searchSelectedIndex >= 0 && items[searchSelectedIndex]) {
        items[searchSelectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }

    function navigateToResult(result) {
      const targetProjectId = result.projectId || projectId;
      if (!targetProjectId) return;
      
      closeSearch();
      window.location.href = '/p/' + targetProjectId + '/' + result.path;
    }

    async function performSearch(query) {
      if (!query || query.trim().length === 0) {
        searchResults.innerHTML = '';
        searchEmpty.textContent = 'Type to search for files and content';
        searchEmpty.style.display = 'block';
        searchResults.appendChild(searchEmpty);
        currentSearchResults = [];
        searchSelectedIndex = -1;
        return;
      }

      // Show loading state
      searchResults.innerHTML = '<div class="search-results-loading">Searching...</div>';
      
      try {
        const params = new URLSearchParams({ q: query });
        if (projectId) params.set('projectId', projectId);
        
        const res = await fetch('/api/search?' + params.toString());
        if (!res.ok) throw new Error('Search failed');
        
        const data = await res.json();
        searchSelectedIndex = data.results.length > 0 ? 0 : -1;
        renderSearchResults(data.results, query);
      } catch (e) {
        searchResults.innerHTML = '<div class="search-results-empty">Search error: ' + e.message + '</div>';
        currentSearchResults = [];
      }
    }

    // Search input handling
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        if (searchDebounce) clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => performSearch(query), 200);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentSearchResults.length > 0) {
            searchSelectedIndex = Math.min(searchSelectedIndex + 1, currentSearchResults.length - 1);
            updateSelectedResult();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentSearchResults.length > 0) {
            searchSelectedIndex = Math.max(searchSelectedIndex - 1, 0);
            updateSelectedResult();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (searchSelectedIndex >= 0 && currentSearchResults[searchSelectedIndex]) {
            navigateToResult(currentSearchResults[searchSelectedIndex]);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeSearch();
        }
      });
    }

    // Close search when clicking outside
    if (searchModal) {
      searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
          closeSearch();
        }
      });
    }

    // Global keyboard shortcut for search (Cmd/Ctrl + K)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (searchModal.classList.contains('active')) {
          closeSearch();
        } else {
          openSearch();
        }
      }
    });
  </script>
</body>
</html>
`;
};

module.exports = {
  slugify,
  escapeHtml,
  getH1Title,
  renderMarkdown,
  html,
};
