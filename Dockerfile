# syntax=docker/dockerfile:1
#
# Image de l'application RPI-PAD (TanStack Start, rendu côté serveur).
# Construction en deux étapes : la première installe les dépendances et
# compile le projet, la seconde n'embarque que ce qui est nécessaire à
# l'exécution.

# ── Étape 1 : construction ──────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Les dépendances sont installées avant la copie du code : tant que
# package-lock.json ne change pas, Docker réutilise cette couche.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Les variables VITE_* sont figées dans le bundle client au moment de la
# construction : elles doivent donc être fournies ici, et non au démarrage.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN npm run build

# ── Étape 2 : exécution ─────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# La compilation produit un gestionnaire de rendu qui n'ouvre aucun port :
# serveur.mjs l'enveloppe dans un vrai serveur HTTP et sert au passage les
# fichiers compilés de dist/client. Vite n'est plus utilisé à l'exécution.
COPY --from=build /app/docker/serveur.mjs ./serveur.mjs

# Le conteneur ne tourne pas en root.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/auth > /dev/null || exit 1

CMD ["node", "serveur.mjs"]
