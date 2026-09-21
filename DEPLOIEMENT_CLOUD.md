# Mise en ligne publique de RPI-PAD

Ce document décrit la mise à disposition de l'application sur Internet, pour
qu'elle s'ouvre depuis n'importe quel appareil. Il complète `DEPLOIEMENT.md`,
qui décrit l'installation en conteneurs sur un serveur du Port Autonome de
Douala ; les deux peuvent coexister.

| | Pile conteneurisée (`DEPLOIEMENT.md`) | Mise en ligne publique (ce document) |
| --- | --- | --- |
| Destination | Serveur interne du PAD | Internet |
| Base, authentification, API | Auto-hébergées (Docker) | Supabase Cloud |
| Application | Conteneur Nginx + Node | Vercel |
| Compilation | `dist/`, servi par `docker/serveur.mjs` | `.vercel/output`, produit par Nitro |

La bascule entre les deux tient à une seule variable : `vite.config.ts`
n'active le greffon Nitro que si la variable d'environnement `VERCEL` est
présente. Aucune des deux compilations n'interfère avec l'autre.

## 1. Préparer le projet Supabase en ligne

Le projet existe déjà : `auitqfhzsgbfardzanum`.

```bash
cd ~/projet_rpi
npx supabase login                       # ouvre le navigateur
npx supabase link --project-ref auitqfhzsgbfardzanum
npx supabase db push                     # applique supabase/migrations/
```

`link` puis `db push` demandent le mot de passe de la base du projet, celui
choisi à sa création. S'il a été perdu, il se réinitialise dans le tableau de
bord Supabase, sous **Settings → Database → Database password**.

Si `db push` signale un historique divergent — le projet ayant été créé par
Lovable, les deux premières migrations peuvent déjà y figurer sous un autre
nom — aligner l'historique sans rejouer ce qui est en place :

```bash
npx supabase migration list              # compare local et distant
npx supabase migration repair --status applied <horodatage_deja_en_place>
npx supabase db push
```

### Jeu de démonstration

Pour une base peuplée le jour de la soutenance (7 agents couvrant les quatre
rôles, 6 infrastructures, 14 demandes) :

```bash
npx supabase db push --include-seed
```

Ces comptes portent tous le mot de passe `Rpi@2026` et ne contiennent aucune
donnée réelle du PAD. Réserve : ce jeu insère directement des lignes dans le
schéma `auth`, ce qui est permis sur une base auto-hébergée mais peut être
refusé sur Supabase Cloud, dont les droits sont plus étroits. Si la commande
échoue sur cette partie, les infrastructures et les demandes sont tout de même
chargées ; créer alors les comptes depuis l'écran « Créer un compte », le
premier inscrit devenant administrateur. Sur une base destinée à un usage réel, ne pas charger ce
jeu : créer le premier compte depuis l'écran « Créer un compte », qui devient
automatiquement administrateur.

### Fonction d'envoi des courriels

```bash
npx supabase functions deploy notify-technicien
npx supabase secrets set RESEND_API_KEY=<clé_resend>
```

Sans `RESEND_API_KEY`, la fonction répond normalement et l'affectation
aboutit : seul le courriel d'accompagnement n'est pas expédié. Les
notifications restent visibles dans l'application.

### Deux réglages à ne pas oublier dans le tableau de bord Supabase

Dans **Authentication → Providers → Email**, désactiver **Confirm email**.
Sans cela, chaque inscription attend une confirmation par courriel, et le
serveur d'envoi fourni par défaut est fortement limité en nombre de messages :
une démonstration s'y bloque.

Dans **Authentication → URL Configuration**, renseigner l'adresse publique de
l'application dans **Site URL**, et l'ajouter aux **Redirect URLs**. Ce réglage
se fait après l'étape 2, une fois l'adresse connue.

## 2. Publier l'application sur Vercel

Le dépôt est déjà sur GitHub, Vercel s'y branche directement.

1. Ouvrir `https://vercel.com` et se connecter avec le compte GitHub.
2. **Add New → Project**, puis importer `schumacher-Github/projet_rpi_v1`.
3. Laisser la détection automatique du cadre applicatif et de la commande de
   construction.
4. Avant de valider, déplier **Environment Variables** et saisir les quatre
   entrées ci-dessous. Les valeurs se trouvent dans le tableau de bord
   Supabase, sous **Settings → API**.

| Nom | Valeur | Rôle |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://auitqfhzsgbfardzanum.supabase.co` | Lue par le navigateur |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clé `sb_publishable_…` | Lue par le navigateur |
| `SUPABASE_URL` | même adresse | Lue par le rendu côté serveur |
| `SUPABASE_PUBLISHABLE_KEY` | même clé publique | Lue par le rendu côté serveur |

Ces quatre valeurs sont publiques par nature : la clé `publishable` est faite
pour circuler dans le navigateur, et ce sont les politiques RLS de la base qui
protègent réellement les données.

Aucune clé secrète n'est nécessaire. Le client d'administration
(`src/integrations/supabase/client.server.ts`, qui lirait
`SUPABASE_SERVICE_ROLE_KEY`) n'est importé par aucun fichier de
l'application : c'est un reliquat du gabarit de départ. La clé `sb_secret_…`
ne doit donc être saisie nulle part — elle contourne les politiques RLS, et
tout ce qui n'existe pas ne peut pas fuiter.

5. Cliquer sur **Deploy**, puis attendre deux à trois minutes.
6. Reporter l'adresse obtenue (`https://….vercel.app`) dans les réglages
   Supabase décrits à la fin de l'étape 1.

## 3. Vérifier

Depuis n'importe quel appareil, y compris un téléphone en données mobiles :

- ouvrir l'adresse Vercel ; la page de connexion doit s'afficher ;
- créer un compte, ou se connecter avec un compte du jeu de démonstration ;
- créer une demande, y affecter un technicien, vérifier que la cloche de
  notification réagit ;
- clôturer la demande avec rapport et coût, puis exporter la fiche en PDF.

Si la page s'affiche mais que la connexion échoue, la cause est presque
toujours l'un des deux réglages Supabase de l'étape 1 : confirmation par
courriel restée active, ou adresse publique absente des **Redirect URLs**.

## 4. Mises à jour

Chaque `git push` sur la branche `main` déclenche une nouvelle publication
Vercel. Une modification du schéma se transmet séparément, par un
`npx supabase db push` après ajout de la migration correspondante.
