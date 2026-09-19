# Configuration locale

## Prerequis

- Docker Desktop lance.
- Node.js avec npm.

## Base Supabase locale

Demarrer Supabase et appliquer les migrations :

```bash
npx supabase start
```

Rejouer toutes les migrations sur une base locale propre :

```bash
npm run supabase:reset
```

Afficher les URLs et cles locales :

```bash
npm run supabase:status
```

## Application

Installer les dependances si besoin :

```bash
npm install
```

Lancer l'application :

```bash
npm run dev
```

Par defaut, l'application est servie par Vite sur `http://localhost:5173`.

## Premier administrateur

Apres creation du premier compte depuis `/auth`, attribuer le role `admin` dans Supabase Studio :

1. Ouvrir Supabase Studio local.
2. Aller dans la table `user_roles`.
3. Remplacer le role du premier utilisateur par `admin`.

Les utilisateurs suivants pourront ensuite etre geres depuis l'interface `Gestion des utilisateurs`.
