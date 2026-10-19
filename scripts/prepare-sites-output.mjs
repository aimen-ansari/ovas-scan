// Preserve the original TanStack/Nitro build and expose the standard Sites layout.
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
if (!existsSync('.output/server/index.mjs')) throw new Error('Build the Nitro Cloudflare module before packaging.');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/server', { recursive: true });
mkdirSync('dist/client', { recursive: true });
cpSync('.output/server', 'dist/server', { recursive: true });
cpSync('.output/public', 'dist/client', { recursive: true });
writeFileSync('dist/server/index.js', 'export { default } from "./index.mjs";\n');
console.log('Prepared Cloudflare Worker and public assets in dist/.');
