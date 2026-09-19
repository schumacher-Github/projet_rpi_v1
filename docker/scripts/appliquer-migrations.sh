#!/usr/bin/env bash
# Applique les migrations du dépôt sur la base du conteneur « db ».
#
# Le script attend d'abord que GoTrue ait créé le schéma « auth » : les
# migrations du projet posent des clés étrangères vers auth.users et
# échoueraient sans lui. Chaque migration appliquée est enregistrée dans
# la table public.migrations_appliquees, ce qui rend le script rejouable.
set -euo pipefail

HOTE="${PGHOST:-db}"
UTILISATEUR="${PGUSER:-postgres}"
BASE="${POSTGRES_DB:-postgres}"
PSQL=(psql -v ON_ERROR_STOP=1 -h "$HOTE" -U "$UTILISATEUR" -d "$BASE" -q)

# Les services GoTrue, PostgREST et Realtime ne se connectent pas avec le
# compte « postgres » mais avec des rôles de service livrés par l'image
# (supabase_auth_admin, authenticator…). Leur mot de passe n'est pas aligné
# sur POSTGRES_PASSWORD à l'initialisation : sans ce passage, ces services
# redémarrent en boucle sur un échec d'authentification.
#
# Ces rôles sont « réservés » : l'extension supautils n'autorise que le
# superutilisateur à les modifier. Dans l'image Supabase, ce n'est pas
# « postgres » mais « supabase_admin ». L'opération est idempotente.
echo "→ Alignement des mots de passe des rôles de service…"

SUPERUTILISATEUR="${PGSUPERUSER:-supabase_admin}"
if psql -h "$HOTE" -U "$SUPERUTILISATEUR" -d "$BASE" -tAc "SELECT 1" >/dev/null 2>&1; then
  PSQL_ADMIN=(psql -v ON_ERROR_STOP=1 -h "$HOTE" -U "$SUPERUTILISATEUR" -d "$BASE" -q)
  echo "  connecté en tant que $SUPERUTILISATEUR."
else
  echo "  ⚠ connexion impossible en tant que $SUPERUTILISATEUR ; repli sur $UTILISATEUR."
  PSQL_ADMIN=("${PSQL[@]}")
fi

if "${PSQL_ADMIN[@]}" -v mdp="$PGPASSWORD" <<'SQL'
SELECT set_config('rpi.mdp', :'mdp', false);
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'authenticator',
    'supabase_auth_admin',
    'supabase_functions_admin',
    'supabase_storage_admin',
    'supabase_replication_admin',
    'pgbouncer'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', r, current_setting('rpi.mdp'));
      RAISE NOTICE '  rôle % aligné', r;
    END IF;
  END LOOP;
END $$;
SQL
then
  echo "  mots de passe alignés."
else
  echo "  ⚠ ÉCHEC de l'alignement : GoTrue et PostgREST ne démarreront pas."
  echo "    Corriger à la main puis relancer ce service :"
  echo "    docker compose exec db psql -U supabase_admin -c \\"
  echo "      \"ALTER ROLE authenticator WITH LOGIN PASSWORD '<POSTGRES_PASSWORD>'\""
fi

echo "→ Attente du schéma auth (créé par GoTrue)…"
for _ in $(seq 1 60); do
  if "${PSQL[@]}" -tAc \
      "SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'" | grep -q 1; then
    echo "  schéma auth disponible."
    break
  fi
  sleep 3
done

"${PSQL[@]}" -c "
  CREATE TABLE IF NOT EXISTS public.migrations_appliquees (
    fichier   TEXT PRIMARY KEY,
    appliquee TIMESTAMPTZ NOT NULL DEFAULT now()
  );"

for fichier in $(ls /migrations/*.sql | sort); do
  nom="$(basename "$fichier")"
  deja="$("${PSQL[@]}" -tAc \
    "SELECT 1 FROM public.migrations_appliquees WHERE fichier = '$nom'")"
  if [ "$deja" = "1" ]; then
    echo "· $nom (déjà appliquée)"
    continue
  fi
  echo "→ $nom"
  "${PSQL[@]}" -f "$fichier"
  "${PSQL[@]}" -c \
    "INSERT INTO public.migrations_appliquees (fichier) VALUES ('$nom')"
done

echo "✔ Migrations à jour."
