import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true
  },
  plugins: [
    {
      name: 'models-api',
      configureServer(server) {
        server.middlewares.use('/api/models', (req, res, next) => {
          if (req.method !== 'GET') return next();
          try {
            const modelsDir = path.resolve(process.cwd(), 'models');
            if (!fs.existsSync(modelsDir)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            const files = fs.readdirSync(modelsDir);
            const models = files
              .filter(f => /\.(obj|gltf|glb|fbx|stl|ply|dae)$/i.test(f))
              .map(f => {
                const stat = fs.statSync(path.join(modelsDir, f));
                return {
                  name: f,
                  filename: f,
                  size: stat.size,
                  url: `/models/${encodeURIComponent(f)}`,
                  ext: path.extname(f).slice(1).toLowerCase(),
                  modified: stat.mtimeMs
                };
              });
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(models));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      },
      closeBundle() {
        // Automatically copy models directory to dist on build for production deployment
        const srcDir = path.resolve(process.cwd(), 'models');
        const outDir = path.resolve(process.cwd(), 'dist/models');
        if (fs.existsSync(srcDir)) {
          fs.mkdirSync(outDir, { recursive: true });
          fs.cpSync(srcDir, outDir, { recursive: true });

          const files = fs.readdirSync(srcDir);
          const models = files
            .filter(f => /\.(obj|gltf|glb|fbx|stl|ply|dae)$/i.test(f))
            .map(f => {
              const stat = fs.statSync(path.join(srcDir, f));
              return {
                name: f,
                filename: f,
                size: stat.size,
                url: `/models/${encodeURIComponent(f)}`,
                ext: path.extname(f).slice(1).toLowerCase(),
                modified: stat.mtimeMs
              };
            });
          fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(models, null, 2));

          const apiDir = path.resolve(process.cwd(), 'dist/api');
          fs.mkdirSync(apiDir, { recursive: true });
          fs.writeFileSync(path.join(apiDir, 'models'), JSON.stringify(models, null, 2));

          // Generate .htaccess for MIME types and caching on Apache servers
          const htaccessContent = `<IfModule mod_mime.c>
  AddType model/gltf-binary .glb
  AddType model/gltf+json .gltf
  AddType application/json .json
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\\.(glb|gltf|obj|json)$">
    Header set Access-Control-Allow-Origin "*"
    Header set Cache-Control "max-age=604800, public"
  </FilesMatch>
</IfModule>
`;
          fs.writeFileSync(path.resolve(process.cwd(), 'dist/.htaccess'), htaccessContent);
        }
      }
    }
  ]
});
