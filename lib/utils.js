/**
 * Utility functions for Mermaid Server
 * File helpers and watcher management.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mime types for static assets
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm',
};

/**
 * Get MIME type for a file extension
 */
const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
};

/**
 * Recursively get markdown files from a directory
 */
const getMarkdownFiles = (dir, prefix = '', recursive = true) => {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      if (recursive)
        files.push(
          ...getMarkdownFiles(path.join(dir, entry.name), fullPath, true),
        );
      else files.push(fullPath + '/');
    } else if (entry.name.endsWith('.md')) files.push(fullPath);
  }
  return files;
};

/**
 * Browse directory contents for the file browser
 */
const browseDirectory = (targetPath) => {
  const dir = targetPath || os.homedir();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = entries
    .filter((e) => !e.name.startsWith('.') || e.name === '.git')
    .map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(dir, e.name),
    }))
    .sort((a, b) =>
      a.isDirectory === b.isDirectory
        ? a.name.localeCompare(b.name)
        : a.isDirectory
          ? -1
          : 1,
    );
  return {
    currentPath: dir,
    parentPath: path.dirname(dir),
    entries: result,
  };
};

/**
 * Validate that a file path is within a project directory
 */
const isPathWithinProject = (projectPath, filePath) => {
  const fullPath = path.join(projectPath, filePath);
  const relative = path.relative(projectPath, fullPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
};

// State for watchers and clients
const clients = new Map(); // projectId -> Set of res objects
const watchers = new Map(); // projectId -> fs.FSWatcher
let debounceTimers = new Map();

/**
 * Notify all connected clients for a project to reload
 */
const notifyClients = (projectId) => {
  if (debounceTimers.has(projectId))
    clearTimeout(debounceTimers.get(projectId));
  const timer = setTimeout(() => {
    const projectClients = clients.get(projectId);
    if (!projectClients) return;
    for (const client of projectClients) {
      if (client.writable && !client.finished) client.write('data: reload\n\n');
    }
    debounceTimers.delete(projectId);
  }, 100);
  debounceTimers.set(projectId, timer);
};

/**
 * Setup a file watcher for a project directory
 */
const setupWatcher = (projectId, dir) => {
  if (watchers.has(projectId)) return;
  try {
    const watcher = fs.watch(
      dir,
      { recursive: true },
      (eventType, filename) => {
        if (filename && filename.endsWith('.md')) notifyClients(projectId);
      },
    );
    watchers.set(projectId, watcher);
  } catch (err) {
    console.error(`Failed to watch ${dir}:`, err.message);
  }
};

/**
 * Add a client to receive SSE notifications
 */
const addClient = (projectId, res) => {
  if (!clients.has(projectId)) clients.set(projectId, new Set());
  clients.get(projectId).add(res);
};

/**
 * Remove a client and cleanup watcher if no clients remain
 */
const removeClient = (projectId, res) => {
  const projectClients = clients.get(projectId);
  if (projectClients) {
    projectClients.delete(res);
    if (projectClients.size === 0) {
      const watcher = watchers.get(projectId);
      if (watcher) {
        watcher.close();
        watchers.delete(projectId);
      }
    }
  }
};

/**
 * Extract H1 title from markdown content
 * @param {string} content - Markdown content
 * @returns {string|null} The H1 title or null
 */
const extractH1Title = (content) => {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
};

/**
 * Check if all search words are found in text
 * @param {string} text - Text to search in
 * @param {string[]} words - Words to find
 * @returns {boolean} True if all words found
 */
const matchesAllWords = (text, words) => {
  const lowerText = text.toLowerCase();
  return words.every((word) => lowerText.includes(word));
};

/**
 * Find the best match position for highlighting
 * @param {string} text - Text to search in
 * @param {string[]} words - Words to find
 * @returns {number} Index of first matching word, or -1
 */
const findFirstMatchIndex = (text, words) => {
  const lowerText = text.toLowerCase();
  let firstIndex = -1;
  for (const word of words) {
    const idx = lowerText.indexOf(word);
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx;
    }
  }
  return firstIndex;
};

/**
 * Search for files by name and content within a project
 * @param {string} projectPath - The root path of the project
 * @param {string} query - The search query
 * @param {number} limit - Maximum number of results
 * @returns {Array} Array of search results
 */
const searchFiles = (projectPath, query, limit = 15) => {
  if (!query || query.trim().length === 0) return [];

  const searchTerm = query.toLowerCase().trim();
  // Split query into words for multi-word matching
  const searchWords = searchTerm.split(/\s+/).filter((w) => w.length > 0);
  const results = [];
  const seenPaths = new Set();

  // Get all markdown files recursively
  const getAllMarkdownFiles = (dir, prefix = '') => {
    const files = [];
    if (!fs.existsSync(dir)) return files;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;

        if (entry.isDirectory()) {
          files.push(...getAllMarkdownFiles(fullPath, relativePath));
        } else if (entry.name.endsWith('.md')) {
          files.push({ fullPath, relativePath, name: entry.name });
        }
      }
    } catch (e) {
      // Skip directories we can't read
    }
    return files;
  };

  const mdFiles = getAllMarkdownFiles(projectPath);

  // First pass: filename matches (highest priority)
  for (const file of mdFiles) {
    if (results.length >= limit) break;
    if (matchesAllWords(file.name, searchWords)) {
      results.push({
        type: 'filename',
        path: file.relativePath,
        name: file.name,
        snippet: file.relativePath,
      });
      seenPaths.add(file.relativePath);
    }
  }

  // Second pass: H1 title matches (high priority)
  for (const file of mdFiles) {
    if (results.length >= limit) break;
    if (seenPaths.has(file.relativePath)) continue;

    try {
      const content = fs.readFileSync(file.fullPath, 'utf-8');
      const h1Title = extractH1Title(content);

      if (h1Title && matchesAllWords(h1Title, searchWords)) {
        results.push({
          type: 'title',
          path: file.relativePath,
          name: file.name,
          snippet: h1Title,
          line: 1,
        });
        seenPaths.add(file.relativePath);
      }
    } catch (e) {
      // Skip files we can't read
    }
  }

  // Third pass: content matches
  for (const file of mdFiles) {
    if (results.length >= limit) break;
    if (seenPaths.has(file.relativePath)) continue;

    try {
      const content = fs.readFileSync(file.fullPath, 'utf-8');

      if (matchesAllWords(content, searchWords)) {
        // Find position of first matching word for snippet
        const matchIndex = findFirstMatchIndex(content, searchWords);

        if (matchIndex !== -1) {
          // Extract snippet with context (50 chars before and after)
          const start = Math.max(0, matchIndex - 50);
          const end = Math.min(content.length, matchIndex + 80);
          let snippet = content.slice(start, end);

          // Clean up snippet
          snippet = snippet.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
          if (start > 0) snippet = '...' + snippet;
          if (end < content.length) snippet = snippet + '...';

          // Calculate line number
          const lineNumber = content.slice(0, matchIndex).split('\n').length;

          results.push({
            type: 'content',
            path: file.relativePath,
            name: file.name,
            snippet: snippet,
            line: lineNumber,
          });
          seenPaths.add(file.relativePath);
        }
      }
    } catch (e) {
      // Skip files we can't read
    }
  }

  return results;
};

module.exports = {
  MIME_TYPES,
  getMimeType,
  getMarkdownFiles,
  browseDirectory,
  isPathWithinProject,
  notifyClients,
  setupWatcher,
  addClient,
  removeClient,
  searchFiles,
};
