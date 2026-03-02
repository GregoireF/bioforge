import { defineConfig } from 'astro/config';

// Astro integrations imports
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';
import AstroPWA from '@vite-pwa/astro';
import Sonda from 'sonda/astro';
import playformInline from '@playform/inline';
import min from 'astro-min';
import compressor from 'astro-compressor';
import purgecss from 'astro-purgecss';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',

  adapter: vercel(),

  vite: {
    plugins: [
      tailwindcss(),
      Sonda({
        server: true
      })
    ],
    build: {
      sourcemap: true
    }
  },

  server: { 
    host: 'bioforge-three.vercel.app'
  },
});