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

// https://astro.build/config
export default defineConfig({
  output: 'server',

  adapter: node({
    mode: 'standalone'
  }),

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
    host: '0.0.0.0'
  },

  integrations: [sitemap(), purgecss({
    content: [
      './src/**/*.{astro,js,jsx,ts,tsx,vue,svelte}'
    ]
  }), playformInline(), min(), compress({
    css: true,
    html: true,
    img: true,
    js: true,
    svg: true,
  }), compressor()]
});