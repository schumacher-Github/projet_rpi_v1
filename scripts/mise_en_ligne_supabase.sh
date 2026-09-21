#!/usr/bin/env bash
# Prépare le projet Supabase en ligne pour RPI-PAD :
# création du projet, application des migrations, déploiement de la fonction
# d'envoi des courriels, puis affichage des valeurs à reporter dans Vercel.
#
#   cd ~/projet_rpi && bash scripts/mise_en_ligne_supabase.sh
#
# Le script est rejouable : si le projet existe déjà, il le réutilise.
set -euo pipefail

ORG="qhwnjqiqwleorgkbutwq"
NOM="rpi-pad"
REGION="eu-west-3"          # Paris, la plus proche de Douala
FICHIER_MDP="$HOME/.rpi-pad-db-password"

titre() { printf '\n\033[1m── %s\033[0m\n' "$1"; }

titre "Vérification de la session Supabase"
if ! npx supabase projects list >/dev/null 2>&1; then
  echo "Non connecté. Lance d'abord :  npx supabase login"
  exit 1
fi
echo "session active."

reference_du_projet() {
  npx supabase projects list --output json 2>/dev/null \
    | python3 -c "
import json, sys
try:
    donnees = json.load(sys.stdin)
except Exception:
    sys.exit(0)
# Selon la version de la CLI, la sortie est une liste ou un objet l'enveloppant.
if isinstance(donnees, dict):
    donnees = donnees.get('projects') or donnees.get('data') or []
for p in donnees:
    if not isinstance(p, dict):
        continue
    if p.get('name') == '$NOM':
        print(p.get('id') or p.get('ref') or p.get('reference_id') or '')
        break
"
}

REF="$(reference_du_projet || true)"

if [ -n "$REF" ]; then
  titre "Projet « $NOM » déjà présent"
  echo "référence : $REF"
  if [ -f "$FICHIER_MDP" ]; then
    DBPASS="$(cat "$FICHIER_MDP")"
    echo "mot de passe relu depuis $FICHIER_MDP"
  else
    echo
    echo "Le mot de passe de la base n'a pas été retrouvé sur ce poste."
    echo "Réinitialise-le dans le tableau de bord Supabase :"
    echo "  Settings → Database → Database password → Reset"
    read -r -s -p "Colle ici le nouveau mot de passe : " DBPASS; echo
    umask 077; printf '%s' "$DBPASS" > "$FICHIER_MDP"
  fi
else
  titre "Création du projet « $NOM »"
  DBPASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  umask 077; printf '%s' "$DBPASS" > "$FICHIER_MDP"
  echo "mot de passe de la base engendré et conservé dans $FICHIER_MDP"
  npx supabase projects create "$NOM" \
    --org-id "$ORG" --region "$REGION" --db-password "$DBPASS"

  echo "attente de la mise en service (jusqu'à 5 minutes)…"
  for _ in $(seq 1 60); do
    REF="$(reference_du_projet || true)"
    [ -n "$REF" ] && break
    sleep 5
  done
  [ -n "$REF" ] || { echo "Projet introuvable après création. Vérifie le tableau de bord."; exit 1; }
  echo "référence : $REF"
fi

export SUPABASE_DB_PASSWORD="$DBPASS"

titre "Rattachement du dépôt au projet"
# La base met encore un moment à accepter les connexions juste après création.
rattache=non
for tentative in $(seq 1 30); do
  if npx supabase link --project-ref "$REF"; then
    # La CLI enregistre la référence dans supabase/.temp/project-ref
    # (elle ne réécrit pas config.toml) : c'est la preuve du rattachement.
    if grep -q "$REF" supabase/.temp/project-ref 2>/dev/null; then
      rattache=oui; break
    fi
  fi
  echo "  base pas encore prête, nouvelle tentative dans 15 s ($tentative/30)…"
  sleep 15
done
if [ "$rattache" != oui ]; then
  echo "Rattachement impossible après 30 tentatives."
  echo "Vérifie l'état du projet dans le tableau de bord, puis relance ce script."
  exit 1
fi

titre "Application des migrations"
# Supabase n'expose plus la base en IPv4 sur la connexion directe. Beaucoup de
# réseaux, dont celui-ci, ne routent pas l'IPv6 : la CLI échoue alors sur
# « no route to host ». Le rattachement a enregistré l'adresse du pooler, qui
# est jointe en IPv4 ; on la lui impose, mot de passe inséré et encodé.
URL_BASE=""
if [ -f supabase/.temp/pooler-url ]; then
  URL_BASE="$(MDP="$DBPASS" python3 -c "
import os, sys, urllib.parse
brute = open('supabase/.temp/pooler-url').read().strip()
mdp = urllib.parse.quote(os.environ['MDP'], safe='')
avant, sépare, après = brute.partition('@')
if not sépare:
    sys.exit(0)
print(f'{avant}:{mdp}@{après}')
")"
fi

if [ -n "$URL_BASE" ]; then
  echo "connexion par le pooler (IPv4)"
  npx supabase db push --db-url "$URL_BASE"
else
  npx supabase db push
fi

titre "Déploiement de la fonction d'envoi des courriels"
npx supabase functions deploy notify-technicien || \
  echo "⚠ échec du déploiement de la fonction — sans conséquence pour la démonstration :
   les notifications restent visibles dans l'application, seul le courriel manque."

titre "Valeurs à reporter dans Vercel"
echo
echo "Adresse du projet :"
echo "  https://$REF.supabase.co"
echo
echo "Clés d'API (la ligne « secret » ne doit jamais porter le préfixe VITE_) :"
npx supabase projects api-keys --project-ref "$REF" --reveal
echo
cat <<'TEXTE'
──────────────────────────────────────────────────────────────
Il reste deux réglages, dans le tableau de bord Supabase :

  1. Authentication → Providers → Email
     décocher « Confirm email »
     (sinon chaque inscription attend un courriel, et le quota
      par défaut est trop faible pour une démonstration)

  2. Authentication → URL Configuration
     à faire APRÈS la publication Vercel, en y reportant
     l'adresse obtenue, en Site URL et en Redirect URLs
──────────────────────────────────────────────────────────────
TEXTE
