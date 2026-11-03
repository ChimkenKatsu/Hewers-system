import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 root:fileURLToPath(new URL('./hosting/vercel',import.meta.url)),
 publicDir:fileURLToPath(new URL('./public',import.meta.url)),
 plugins:[react()],
 define:{__HEWERS_VERCEL__:'true'},
 build:{outDir:fileURLToPath(new URL('./dist/vercel',import.meta.url)),emptyOutDir:true},
});
