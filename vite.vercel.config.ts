import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const offlineWorker=new URL('./hosting/vercel/offline-worker.js',import.meta.url);
const modelDirectory=new URL('./public/face-models/',import.meta.url);
export default defineConfig({
 root:fileURLToPath(new URL('./hosting/vercel',import.meta.url)),
 publicDir:fileURLToPath(new URL('./public',import.meta.url)),
 plugins:[react(),{
   name:'hewers-offline-shell',
   apply:'build',
   enforce:'post',
   generateBundle(_options,bundle){
     const shellAssets=Object.keys(bundle).filter(name=>name.endsWith('.js')||name.endsWith('.css')).sort();
     const staticFiles=['/hewers-logo.png','/hewers-logo.svg','/hewers-logo-white.svg','/hewers-mark.svg','/vendor/face-api-1.7.15.js',
       ...readdirSync(modelDirectory).sort().map(name=>'/face-models/'+name)];
     const files=['/',...shellAssets.map(name=>'/'+name),...staticFiles];
     const template=readFileSync(offlineWorker,'utf8');
     const hash=createHash('sha256').update(template).update(JSON.stringify(files));
     for(const file of staticFiles)hash.update(readFileSync(new URL('./public'+file,import.meta.url)));
     const version=hash.digest('hex').slice(0,16);
     this.emitFile({type:'asset',fileName:'hewers-offline.js',source:template
       .replace('__OFFLINE_CACHE__',JSON.stringify('hewers-shell-'+version))
       .replace('__OFFLINE_FILES__',JSON.stringify(files))});
   },
 }],
 define:{__HEWERS_VERCEL__:'true'},
 build:{outDir:fileURLToPath(new URL('./dist/vercel',import.meta.url)),emptyOutDir:true},
});
