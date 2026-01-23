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
};
