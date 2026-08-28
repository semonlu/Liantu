import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root:path.resolve(__dirname,'mobile'),
  base:'./',
  publicDir:path.resolve(__dirname,'public'),
  plugins:[react()],
  resolve:{alias:{'@':path.resolve(__dirname,'.')}},
  build:{outDir:path.resolve(__dirname,'dist-mobile'),emptyOutDir:true,rollupOptions:{input:path.resolve(__dirname,'mobile/index.html')}},
});
