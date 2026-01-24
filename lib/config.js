/**
 * Configuration management for Mermaid Server
 * Handles loading, saving, and accessing project/settings configuration.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const CONFIG_PATH = path.join(os.homedir(), '.mermaid-server.json');

// State
let config = {
  projects: [],
  settings: { sidebarSticky: true },
};

const normalizeFavoritePath = (favoritePath) => {
  if (!favoritePath || favoritePath === '/') return '';
  return favoritePath.replace(/^\/+/, '').replace(/\/+$/, '');
};

const normalizeProjects = (projects) => {
  if (!Array.isArray(projects)) return [];
  return projects.map((project) => ({
    ...project,
    favorites: Array.isArray(project.favorites) ? project.favorites : [],
  }));
};

/**
 * Load configuration from disk
 */
const loadConfig = () => {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      config = { ...config, ...data };
      config.projects = normalizeProjects(config.projects);
    } catch (e) {
      console.error('Failed to load config:', e.message);
    }
  }
};

/**
 * Save configuration to disk
 */
const saveConfig = () => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e.message);
  }
};

/**
 * Get the current configuration
 */
const getConfig = () => config;

/**
 * Get all projects
 */
const getProjects = () => config.projects;

/**
 * Get settings
 */
const getSettings = () => config.settings;

/**
 * Find a project by ID
 */
const findProject = (id) => config.projects.find((p) => p.id === id);

/**
 * Add a new project
 */
const addProject = (name, projectPath) => {
  const newProject = {
    id: crypto.randomBytes(4).toString('hex'),
    name,
    path: path.resolve(projectPath),
    favorites: [],
  };
  config.projects.push(newProject);
  saveConfig();
  return newProject;
};

/**
 * Update a project
 */
const updateProject = (id, data) => {
  const project = findProject(id);
  if (project) {
    Object.assign(project, data);
    if (data.path) project.path = path.resolve(data.path);
    if (data.favorites) {
      project.favorites = Array.isArray(data.favorites) ? data.favorites : [];
    }
    saveConfig();
  }
  return project;
};

/**
 * Delete a project
 */
const deleteProject = (id) => {
  config.projects = config.projects.filter((p) => p.id !== id);
  saveConfig();
};

const addFavorite = (projectId, data) => {
  const project = findProject(projectId);
  if (!project) return null;
  if (!project.favorites) project.favorites = [];
  const favoritePath = normalizeFavoritePath(data.path);
  const existing = project.favorites.find((fav) => fav.path === favoritePath);
  if (existing) return existing;
  const favorite = {
    id: crypto.randomBytes(4).toString('hex'),
    name: data.name,
    path: favoritePath,
  };
  project.favorites.push(favorite);
  saveConfig();
  return favorite;
};

const updateFavorite = (projectId, favoriteId, data) => {
  const project = findProject(projectId);
  if (!project || !project.favorites) return null;
  const favorite = project.favorites.find((fav) => fav.id === favoriteId);
  if (!favorite) return null;
  if (typeof data.name === 'string') favorite.name = data.name;
  if (typeof data.path === 'string') {
    favorite.path = normalizeFavoritePath(data.path);
  }
  saveConfig();
  return favorite;
};

const deleteFavorite = (projectId, favoriteId) => {
  const project = findProject(projectId);
  if (!project || !project.favorites) return false;
  const nextFavorites = project.favorites.filter((fav) => fav.id !== favoriteId);
  if (nextFavorites.length === project.favorites.length) return false;
  project.favorites = nextFavorites;
  saveConfig();
  return true;
};

/**
 * Update settings
 */
const updateSettings = (data) => {
  config.settings = { ...config.settings, ...data };
  saveConfig();
  return config.settings;
};

/**
 * Add a project from CLI argument if it doesn't exist
 */
const addProjectFromCLI = (argPath) => {
  if (!argPath) return null;
  const absolutePath = path.resolve(argPath);
  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
    const existing = config.projects.find((p) => p.path === absolutePath);
    if (!existing) {
      return addProject(path.basename(absolutePath) || 'Default', absolutePath);
    }
  }
  return null;
};

// Load config on module initialization
loadConfig();

module.exports = {
  CONFIG_PATH,
  loadConfig,
  saveConfig,
  getConfig,
  getProjects,
  getSettings,
  findProject,
  addProject,
  updateProject,
  deleteProject,
  addFavorite,
  updateFavorite,
  deleteFavorite,
  updateSettings,
  addProjectFromCLI,
};
