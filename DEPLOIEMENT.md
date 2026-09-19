# Déploiement de RPI-PAD

La plateforme se déploie en conteneurs sur un serveur du Port Autonome de
Douala. Rien n'est publié sur Internet : seul le port HTTPS du frontal est
exposé, et uniquement sur le réseau interne de l'établissement.

## Ce que la pile contient

| Conteneur | Rôle | Port exposé |
| --- | --- | --- |
| `nginx` | Frontal HTTPS, aiguillage vers l'application ou l'API | 80, 443 (hôte) |
| `app` | Application TanStack Start, rendu côté serveur | 3000 (interne) |
| `kong` | Passerelle d'API de la pile Supabase | 8000 (interne) |
| `auth` | GoTrue — comptes, mots de passe, jetons | 9999 (interne) |
| `rest` | PostgREST — API REST sur le schéma `public` | 3000 (interne) |
| `realtime` | Diffusion des notifications en direct | 4000 (interne) |
| `functions` | Edge Runtime — envoi des courriels | 9000 (interne) |
| `db` | PostgreSQL — données et sauvegardes | 5432 (interne) |
| `migrations` | Applique les migrations au premier démarrage | — |

La base de données n'est **pas** publiée sur l'hôte : elle n'est joignable que
depuis le réseau `rpi-net`. Les données vivent dans le volume nommé
`rpi-pad_pg_data`, qui survit à la suppression et à la recréation des
conteneurs.

## Mise en service

### 1. Préparer les secrets

```bash
cp .env.docker.example .env.docker
```

Remplacer chaque valeur marquée « à remplacer » :

```bash
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 64   # REALTIME_SECRET_KEY_BASE
openssl rand -hex 8       # REALTIME_ENC_KEY (16 caractères)
```

Les `ANON_KEY` et `SERVICE_ROLE_KEY` livrées dans le fichier d'exemple sont les
clés de démonstration publiques de Supabase. **Elles doivent être régénérées**
une fois `JWT_SECRET` changé : ce sont deux jetons JWT signés avec ce secret,
portant respectivement `{"role":"anon"}` et `{"role":"service_role"}`, une date
d'émission (`iat`) et une date d'expiration (`exp`) lointaine. Le générateur de
clés de la documentation d'auto-hébergement Supabase les produit à partir du
secret ; on peut aussi les fabriquer avec n'importe quelle bibliothèque JWT.

Ne jamais commiter `.env.docker` : il est déjà exclu par `.dockerignore` et doit
l'être aussi par `.gitignore`.

### 2. Déposer le certificat

```bash
mkdir -p docker/nginx/certs
cp rpi-pad.crt rpi-pad.key docker/nginx/certs/
```

Le certificat est celui de l'autorité interne du PAD. Pour une recette, un
certificat auto-signé suffit :

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/certs/rpi-pad.key \
  -out docker/nginx/certs/rpi-pad.crt \
  -subj "/C=CM/ST=Littoral/L=Douala/O=Port Autonome de Douala/CN=rpi.pad.cm"
```

### 3. Démarrer

```bash
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker logs -f migrations
```

Le service `migrations` attend que GoTrue ait créé le schéma `auth`, puis
applique dans l'ordre les fichiers de `supabase/migrations`. Il tient la liste
de ce qu'il a déjà posé dans `public.migrations_appliquees` : le relancer ne
rejoue rien inutilement.

### 4. Créer le premier administrateur

Sur une base encore vierge de tout rôle, **le premier compte créé depuis
l'écran « Créer un compte » devient administrateur** (voir
`COMPTES_ET_ROLES.md`). Ouvrir `https://rpi.pad.cm/auth`, créer le compte du
responsable, puis attribuer leurs rôles aux autres agents depuis
« Administration → Utilisateurs ».

> Le jeu de démonstration `supabase/seed.sql` n'est **jamais** chargé par cette
> pile. Il ne doit pas l'être sur la base de production.

## Exploitation courante

```bash
# État des services
docker compose --env-file .env.docker ps

# Journaux d'un service
docker compose --env-file .env.docker logs -f app

# Session SQL d'exploitation
docker compose --env-file .env.docker exec db psql -U postgres

# Redéployer après une modification du code
docker compose --env-file .env.docker up -d --build app

# Rejouer les migrations après en avoir ajouté une
docker compose --env-file .env.docker run --rm migrations
```

### Sauvegarde

Une sauvegarde complète dans le volume dédié :

```bash
docker compose --env-file .env.docker exec db \
  pg_dump -U postgres -Fc postgres \
  -f /sauvegardes/rpi-$(date +%F).dump
```

À planifier quotidiennement dans la `crontab` du serveur, avec une rotation de
trente jours :

```cron
0 2 * * * cd /opt/rpi-pad && docker compose --env-file .env.docker exec -T db \
  pg_dump -U postgres -Fc postgres -f /sauvegardes/rpi-$(date +\%F).dump
30 2 * * * docker run --rm -v rpi-pad_pg_sauvegardes:/s alpine \
  find /s -name '*.dump' -mtime +30 -delete
```

### Restauration

```bash
docker compose --env-file .env.docker exec db \
  pg_restore -U postgres -d postgres --clean --if-exists \
  /sauvegardes/rpi-2026-09-15.dump
```

## Versions des images

Les versions des images Supabase (`gotrue`, `postgrest`, `realtime`,
`edge-runtime`, `postgres`) sont celles de la référence d'auto-hébergement. Si
l'une d'elles n'était plus disponible sur le registre, aligner les étiquettes
sur celles du fichier de référence :

```bash
curl -s https://raw.githubusercontent.com/supabase/supabase/master/docker/docker-compose.yml \
  | grep 'image:'
```

et reporter les versions dans `docker-compose.yml`. Les noms de services et les
variables d'environnement utilisés ici suivent cette même référence.

## Développement local

Pour travailler sur le poste de développement, la pile complète n'est pas
nécessaire — la CLI Supabase suffit :

```bash
npx supabase start
npm install
npm run dev
```

Voir `LOCAL_SETUP.md`.

## Vérification après le premier démarrage

À exécuter une fois `docker compose --env-file .env.docker up -d --build`
terminé (compter 2 à 5 minutes au premier lancement, le temps du
téléchargement des images) :

```bash
# 1. Tous les services doivent être « running » (migrations : « exited (0) »)
docker compose --env-file .env.docker ps -a

# 2. Les migrations doivent se terminer par « ✔ Migrations à jour. »
docker compose --env-file .env.docker logs migrations | tail -8

# 3. L'application répond derrière Nginx (-k : certificat auto-signé)
curl -k -s -o /dev/null -w "app  : %{http_code}\n" https://localhost/auth

# 4. L'API passe par Kong : sans clé 401, avec la clé anon 200
curl -k -s -o /dev/null -w "sans clé : %{http_code}\n" https://localhost/rest/v1/
curl -k -s -o /dev/null -w "avec clé : %{http_code}\n" \
  -H "apikey: $(grep '^ANON_KEY=' .env.docker | cut -d= -f2)" https://localhost/rest/v1/

# 5. Temps réel et fonctions Edge sans erreur de démarrage
docker compose --env-file .env.docker logs --tail 15 realtime functions
```

Si `realtime` redémarre en boucle avec « schema _realtime does not exist »,
le volume de la base a été créé avant l'ajout de `docker/db/realtime.sql` :
supprimer le volume (`docker compose down -v`, **efface les données**) et
relancer, ou créer le schéma à la main :

```bash
docker compose --env-file .env.docker exec db psql -U postgres \
  -c "create schema if not exists _realtime; alter schema _realtime owner to supabase_admin;"
```
