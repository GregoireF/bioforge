# 1️⃣ Image Bun officielle
FROM oven/bun:1.3.10

# 2️⃣ Répertoire de travail
WORKDIR /app

# 3️⃣ Copier les fichiers essentiels
COPY package.json bun.lock ./
COPY tsconfig.json ./
COPY astro.config.mjs ./
COPY src ./src
COPY public ./public
COPY .env /.

# 4️⃣ Installer toutes les dépendances (dev + prod pour build)
RUN bun install

# 5️⃣ Builder Astro (SSR ou static)
RUN bun run astro build

# 7️⃣ Démarrer Astro SSR
# --host 0.0.0.0 pour que le container soit accessible depuis l'extérieur
CMD ["bun", "run", "astro", "preview", "start", "--host", "0.0.0.0"]