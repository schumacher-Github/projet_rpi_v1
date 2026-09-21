#!/usr/bin/env bash
# Charge le jeu de démonstration dans la base en ligne.
#
#   cd ~/projet_rpi && bash scripts/charger_demonstration.sh
#
# Sept agents couvrant les quatre rôles, six infrastructures, quatorze
# demandes, un journal d'intervention et des notifications. Aucune donnée
# réelle du Port Autonome de Douala. Le script est rejouable.
set -euo pipefail

FICHIER_MDP="$HOME/.rpi-pad-db-password"

titre() { printf '\n\033[1m── %s\033[0m\n' "$1"; }

[ -f supabase/seed.sql ] || { echo "supabase/seed.sql introuvable."; exit 1; }
[ -f supabase/.temp/project-ref ] || {
  echo "Projet non rattaché. Lance d'abord : bash scripts/mise_en_ligne_supabase.sh"; exit 1; }
[ -f "$FICHIER_MDP" ] || {
  echo "Mot de passe de la base introuvable ($FICHIER_MDP)."
  echo "Relance d'abord : bash scripts/mise_en_ligne_supabase.sh"; exit 1; }

REF="$(cat supabase/.temp/project-ref)"
DBPASS="$(cat "$FICHIER_MDP")"
export SUPABASE_DB_PASSWORD="$DBPASS"

titre "Projet visé"
echo "  $REF"
echo
echo "Ce jeu est destiné à la démonstration. Il ne doit jamais être chargé"
echo "sur une base contenant de vraies données du PAD."
read -r -p "Continuer ? [o/N] " reponse
case "$reponse" in [oO]*) ;; *) echo "Annulé."; exit 0 ;; esac

# Connexion par le pooler : Supabase n'expose plus la base en IPv4 en direct.
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

titre "Chargement du jeu de démonstration"
if [ -n "$URL_BASE" ]; then
  npx supabase db push --include-seed --db-url "$URL_BASE" && etat=ok || etat=echec
else
  npx supabase db push --include-seed && etat=ok || etat=echec
fi

if [ "$etat" = ok ]; then
  titre "Chargé"
  cat <<'TEXTE'
Comptes de démonstration, mot de passe commun : Rpi@2026

  s.ngando@pad.cm     Administrateur    Serge NGANDO
  e.biloa@pad.cm      Chef de service   Emmanuel BILOA
  p.atangana@pad.cm   Technicien        Paul ATANGANA     (électricité)
  r.mbida@pad.cm      Technicien        Rose MBIDA        (plomberie)
  a.fotso@pad.cm      Technicien        Alain FOTSO       (climatisation)
  c.nkolo@pad.cm      Demandeur         Clarisse NKOLO    (exploitation)
  jp.ebode@pad.cm     Demandeur         Jean-Pierre EBODE (capitainerie)

Ton propre compte administrateur reste valable : ces comptes s'ajoutent,
ils ne remplacent rien.

Vérifie maintenant sur https://projet-rpi-v1.vercel.app
TEXTE
else
  titre "Échec"
  cat <<'TEXTE'
Le chargement a échoué. La cause la plus probable est le refus d'insérer
des comptes dans le schéma « auth », dont les droits sont plus étroits sur
Supabase Cloud qu'en auto-hébergé.

Envoie-moi le message d'erreur ci-dessus : selon qu'il porte sur les
comptes ou sur les données métier, la suite diffère. Les infrastructures
et les demandes peuvent être chargées sans les comptes, et les comptes
peuvent être créés depuis l'écran « Créer un compte » de l'application.
TEXTE
  exit 1
fi
