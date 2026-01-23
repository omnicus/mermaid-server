# AGENTS.md - Mermaid-MD Development Guide

Guide for AI coding agents working on this codebase.

## Project Overview

Mermaid-MD is a local Node.js server for rendering Markdown files with Mermaid diagrams.
Features live reload, multi-project support, syntax highlighting, and a clean reading experience.

**Tech Stack:** Node.js (vanilla), CommonJS modules, `marked` library, pure CSS, vanilla JS

## Build/Lint/Test Commands

```bash
npm start                      # Start server (default port 4000)
npm run dev                    # Start with current directory as project
node server.js /path/to/docs   # Start with specific docs directory
PORT=3000 npm start            # Custom port
npm install                    # Install dependencies
```

### Testing

No automated tests currently. When adding tests:
- Use Node.js built-in test runner (`node --test`) or Jest
- Place test files in `test/` or `__tests__/` directory
- Name test files as `*.test.js` or `*.spec.js`

### Linting

No linter configured. To add ESLint: `npm install --save-dev eslint && npx eslint --init`

## Code Style Guidelines

### File Structure

```
mermaid-md/
  server.js       # Main application (single-file architecture)
  package.json    # Project configuration
  example.md      # Example Markdown with Mermaid diagrams
```

### JavaScript Style

**Imports** - CommonJS only, Node.js built-ins first, then external packages:
```javascript
const http = require("http");
const fs = require("fs");
const path = require("path");
const { marked } = require("marked");  // External packages last
```

**Formatting:**
- 2-space indentation
- Double quotes for strings
- Semicolons required
- Lines under 100 characters
- Template literals for HTML/multi-line strings

**Naming Conventions:**
- `camelCase` for variables and functions
- `UPPER_SNAKE_CASE` for constants
- Descriptive names (e.g., `getMarkdownFiles`, `notifyClients`)

```javascript
const PORT = process.env.PORT || 4000;
const CONFIG_PATH = path.join(os.homedir(), ".mermaid-server.json");
const getMarkdownFiles = (dir, prefix = "", recursive = true) => { ... };
```

**Functions:** Prefer arrow functions for callbacks and simple functions.

**Error Handling:** Use try/catch for file operations, log errors with descriptive messages:
```javascript
try {
  const data = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  config = { ...config, ...data };
} catch (e) {
  console.error("Failed to load config:", e.message);
}
```

### HTML/CSS Style (Embedded in server.js)

- CSS variables for theming (e.g., `--primary-color: #6366f1`)
- BEM-like class naming (e.g., `.project-item`, `.code-block-wrapper`)
- Mobile-responsive with media queries
- Flexbox for layouts

### Client-Side JavaScript

- Vanilla JS only (no frameworks)
- `async/await` for fetch operations
- Event delegation where appropriate

## Architecture

### Single-File Design

The entire server is in `server.js`. If refactoring, consider splitting into:
- `server.js` - HTTP server and routing
- `renderer.js` - Markdown/HTML rendering
- `watcher.js` - File watching and SSE
- `config.js` - Configuration management

### Key Components

1. **HTTP Server** - Routing for pages, API, and SSE
2. **Marked Renderer** - Custom renderer for Mermaid code blocks and headings
3. **File Watcher** - `fs.watch` with recursive option for live reload
4. **SSE** - Server-Sent Events for reload notifications
5. **Config** - Persists to `~/.mermaid-server.json`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | POST | Create new project |
| `/api/projects/:id` | PATCH | Update project |
| `/api/projects/:id` | DELETE | Remove project |
| `/api/settings` | PATCH | Update settings |
| `/api/browse` | GET | Browse filesystem |
| `/__reload` | GET | SSE endpoint for live reload |

### URL Structure

- `/` - Dashboard (project list)
- `/p/:projectId/` - Project root (README or file list)
- `/p/:projectId/path/to/file.md` - Render specific Markdown file

## Common Tasks

### Adding Features

1. Locate relevant section in `server.js`
2. UI changes: modify `html()` template function
3. API changes: add handlers in request handler (starts ~line 999)
4. Test manually with `npm start`

### Modifying Markdown Rendering

The `renderer` object controls rendering (~line 96):
```javascript
const renderer = {
  code(token) { ... },    // Code blocks (including mermaid)
  heading(token) { ... }, // Headings with anchor links
};
```

### Key Line References in server.js

- Imports: lines 1-14
- Constants: lines 15-35
- Config helpers: lines 47-64
- Marked renderer: lines 86-118
- HTML template: lines 125-958
- File helpers: lines 960-987
- HTTP server: lines 999-1142

## Dependencies

- `marked` (^15.0.0) - Markdown parser
- External CDN: Mermaid.js, Highlight.js (loaded in browser)
