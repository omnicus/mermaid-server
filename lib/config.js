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

/**
 * Load configuration from disk
 */
const loadConfig = () => {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      config = { ...config, ...data };
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
  updateSettings,
  addProjectFromCLI,
};
