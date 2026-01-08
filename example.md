# Mermaid Server Example

This is an example markdown file to test the Mermaid server.

## Flowchart

```mermaid
flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Browser
    participant Server
    participant FileSystem
    
    Browser->>Server: GET /example.md
    Server->>FileSystem: Read file
    FileSystem-->>Server: File content
    Server-->>Browser: Rendered HTML
```

## Class Diagram

```mermaid
classDiagram
    class Server {
        +port: number
        +docsDir: string
        +start()
        +handleRequest()
    }
    class FileWatcher {
        +watch(dir)
        +notifyClients()
    }
    Server --> FileWatcher
```

## Code Example

Here's some JavaScript code:

```javascript
const server = http.createServer((req, res) => {
  res.end('Hello World!');
});
```

## Features

- **Live reload**: Edit your markdown files and see changes instantly
- **Mermaid support**: All mermaid diagram types are supported
- **Full markdown**: Tables, code blocks, lists, and more

| Feature | Status |
|---------|--------|
| Markdown | Done |
| Mermaid | Done |
| Live Reload | Done |

> This is a blockquote to show styling works correctly.
