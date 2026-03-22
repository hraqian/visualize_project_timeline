import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const PROJECTS_DIR = path.resolve(__dirname, 'data', 'projects');

/** Ensure the projects directory exists. */
function ensureDir(): void {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

/** Sanitize a project name for use in a filename. */
function toFileName(name: string, id: string): string {
  const safe = name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  const shortId = id.slice(0, 8);
  return `${safe || 'Untitled'} (${shortId}).json`;
}

/** Read and parse request body as JSON. */
function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Vite plugin that adds API endpoints for project file I/O.
 *
 * Endpoints:
 *   GET  /api/projects         - list all projects
 *   POST /api/projects         - save a project (body = project JSON)
 *   GET  /api/projects/:id     - load a project by ID
 *   DELETE /api/projects/:id   - delete a project by ID
 */
export default function projectStoragePlugin(): Plugin {
  return {
    name: 'project-storage',
    configureServer(server) {
      ensureDir();

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '/';

        // ── GET /api/projects ── list all projects
        if (url === '/api/projects' && req.method === 'GET') {
          ensureDir();
          const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'));
          const entries = [];
          for (const file of files) {
            try {
              const filePath = path.join(PROJECTS_DIR, file);
              const raw = fs.readFileSync(filePath, 'utf-8');
              const data = JSON.parse(raw);
              const stat = fs.statSync(filePath);
              if (data.projectId && data.projectName) {
                entries.push({
                  id: data.projectId,
                  name: data.projectName,
                  fileName: file,
                  lastModified: stat.mtime.toISOString(),
                });
              }
            } catch {
              // Skip unparseable files
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(entries));
          return;
        }

        // ── POST /api/projects ── save a project
        if (url === '/api/projects' && req.method === 'POST') {
          try {
            const body = await readBody(req);
            const data = JSON.parse(body);
            if (!data.projectId || !data.projectName) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing projectId or projectName' }));
              return;
            }
            ensureDir();
            const newFileName = toFileName(data.projectName, data.projectId);

            // Remove old file if project was renamed
            const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'));
            for (const file of files) {
              if (file === newFileName) continue;
              try {
                const existing = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf-8'));
                if (existing.projectId === data.projectId) {
                  fs.unlinkSync(path.join(PROJECTS_DIR, file));
                  break;
                }
              } catch {
                // Skip
              }
            }

            // Write the file
            fs.writeFileSync(
              path.join(PROJECTS_DIR, newFileName),
              JSON.stringify(data, null, 2),
              'utf-8'
            );

            const now = new Date().toISOString();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ saved: true, lastModified: now }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }

        // ── GET /api/projects/:id ── load a project
        // ── DELETE /api/projects/:id ── delete a project
        const match = url.match(/^\/api\/projects\/(.+)$/);
        if (match) {
          const id = match[1];

          if (req.method === 'GET') {
            ensureDir();
            const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'));
            for (const file of files) {
              try {
                const raw = fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf-8');
                const data = JSON.parse(raw);
                if (data.projectId === id) {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(raw);
                  return;
                }
              } catch {
                // Skip
              }
            }
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
          }

          if (req.method === 'DELETE') {
            ensureDir();
            const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'));
            for (const file of files) {
              try {
                const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf-8'));
                if (data.projectId === id) {
                  fs.unlinkSync(path.join(PROJECTS_DIR, file));
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ deleted: true }));
                  return;
                }
              } catch {
                // Skip
              }
            }
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
          }
        }

        next();
      });
    },
  };
}
