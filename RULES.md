# Project Rules: Mermaid Server

## Technical Stack
- **Backend**: Node.js (Core http module)
- **Frontend**: Vanilla JavaScript, Modern CSS (Grid/Flexbox)
- **Libraries**: 
  - `mermaid.js` (Diagrams)
  - `marked` (Markdown parsing)
  - `highlight.js` (Syntax highlighting)

## Design System
- **Tone**: Modern Utilitarian / Developer-Centric
- **Primary Color**: #6366f1 (Indigo)
- **Neutral Colors**: 
  - Text: #111827 (Gray 900)
  - Secondary Text: #4b5563 (Gray 600)
  - Border: #e5e7eb (Gray 200)
  - Background: #ffffff
  - Sidebar: #f9fafb
- **Typography**: 
  - UI: system-ui, -apple-system, sans-serif
  - Monospace: ui-monospace, 'JetBrains Mono', 'SF Mono', monospace
- **Accessibility**: 
  - WCAG 2.1 AA compliance
  - High contrast for text (4.5:1 minimum)
  - Visible focus indicators
  - Semantic HTML

## Development Workflow
- **Code Style**: clean, minimal comments (focus on 'why'), idiomatic Node.js.
- **Performance**: Minimize external dependencies; leverage CDN for large frontend libraries.
- **Stability**: Ensure server handles missing files or invalid paths gracefully.
