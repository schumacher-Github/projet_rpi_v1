# Se connecter avec chaque rôle

## Les quatre rôles

| Rôle | Ce qu'il peut faire |
| --- | --- |
| **Administrateur** | Tout, plus la gestion des comptes et des rôles (écran « Utilisateurs ») |
| **Chef de service** | Priorisation, affectation, tableau de bord, historique, référentiel des infrastructures |
| **Technicien** | Traite les interventions qui lui sont affectées : statut, rapport et coût de clôture |
| **Demandeur** | Soumet des demandes et suit leur avancement |

Un compte peut cumuler plusieurs rôles : les rôles sont stockés dans une table
dédiée (`user_roles`), pas dans une colonne du profil.

## Comment obtenir un premier administrateur

C'était jusqu'ici impossible : tout nouveau compte recevait le rôle « demandeur »,
et seul un administrateur peut attribuer les rôles — personne ne pouvait donc en
devenir un. La migration `20260915120000_droits_roles_et_amorcage_admin.sql` règle
le problème : **sur une base encore vierge de tout rôle, le premier compte qui
s'inscrit devient administrateur.** Les comptes suivants restent des demandeurs,
et c'est l'administrateur qui leur attribue leur rôle depuis l'écran
« Utilisateurs ».

Concrètement, sur une base neuve :

```bash
npx supabase db reset     # applique les migrations puis le fichier seed.sql
npm run dev
```

puis, sur l'écran de connexion, onglet « Créer un compte » : le compte créé est
administrateur.

## Les comptes de démonstration

`supabase/seed.sql` installe **le jeu de données qui a servi aux captures d'écran du
mémoire** : sept agents couvrant les quatre rôles, six infrastructures portuaires,
quatorze demandes d'intervention réparties sur deux mois, le journal d'une
intervention en cours et les notifications du chef de service. Il est rejoué à chaque
`npx supabase db reset` et ne crée pas de doublons si vous l'exécutez deux fois.

**Mot de passe commun : `Rpi@2026`**

| Adresse | Rôle | Agent | Service |
| --- | --- | --- | --- |
| `s.ngando@pad.cm` | Administrateur | Serge NGANDO | Direction des Systèmes d'Information |
| `e.biloa@pad.cm` | Chef de service | Emmanuel BILOA | Régie du Patrimoine Immobilier |
| `p.atangana@pad.cm` | Technicien | Paul ATANGANA | Maintenance électrique |
| `r.mbida@pad.cm` | Technicien | Rose MBIDA | Plomberie et réseaux hydrauliques |
| `a.fotso@pad.cm` | Technicien | Alain FOTSO | Froid et climatisation |
| `c.nkolo@pad.cm` | Demandeur | Clarisse NKOLO | Exploitation portuaire |
| `jp.ebode@pad.cm` | Demandeur | Jean-Pierre EBODE | Capitainerie |

Connectez-vous successivement avec chacun : les données visibles changent à chaque
fois, puisque le cloisonnement est appliqué par la base elle-même. Sur ce jeu de
données, le chef de service voit les 14 demandes, Clarisse NKOLO n'en voit que 7
(les siennes) et Paul ATANGANA 5 (celles qui lui sont affectées).

Les dates sont relatives au jour d'exécution : le tableau de bord affiche donc
toujours une activité récente, quel que soit le jour de la démonstration. Sur le jeu
livré, il indique 14 demandes, 3 urgences en attente, 3 interventions en cours, un
délai moyen de résolution d'environ 8 jours et un taux de résolution de 57 %.

Ces comptes sont réservés au développement et à la démonstration. **Ne jouez jamais
`seed.sql` sur la base de production du Port Autonome de Douala**, et changez le mot
de passe de tout compte réel créé à partir de ce modèle.

## Promouvoir un agent en administrateur à la main

Si vous avez besoin d'un second administrateur et qu'aucun n'est disponible pour le
faire depuis l'application, exécutez depuis l'éditeur SQL de Supabase (ou `psql`) :

```sql
SELECT public.promouvoir_administrateur('adresse@pad.cm');
```

Cette fonction n'est volontairement pas exécutable depuis l'application : elle est
réservée à un accès direct à la base.

## Changer le rôle d'un agent depuis l'application

Connecté en administrateur : menu **Administration → Utilisateurs**, puis choisir le
rôle dans la liste déroulante de la ligne concernée. La modification est immédiate ;
l'agent la voit à sa prochaine connexion (ou après rechargement de la page).

## Mon espace de travail

Chaque agent dispose d'un écran personnel, accessible depuis le menu latéral
(« Mon espace ») ou depuis son avatar en haut à droite :

- **Mes informations** : prénom, nom, téléphone, service, matricule. L'adresse de
  connexion n'est pas modifiable par l'agent lui-même.
- **Sécurité** : changement de mot de passe, sans déconnexion.
- **Apparence** : thème clair, sombre ou automatique. Le réglage est propre au poste
  de travail et survit au rechargement.
- **Mon rôle et mes droits** : rappel de ce que le rôle autorise.

## En cas d'erreur « permission denied for function has_role »

Ce message signifie que le rôle `authenticated` n'a pas le droit d'exécuter la
fonction sur laquelle reposent toutes les politiques de sécurité : plus aucune
lecture ne passe. La migration `20260915120000` accorde ce droit explicitement et
pose une règle de droits par défaut pour que le problème ne réapparaisse pas aux
migrations suivantes.

Si la base est déjà en place et que vous ne souhaitez pas la réinitialiser :

```bash
npx supabase db push        # base distante
# ou, en local :
npx supabase migration up
```

En dépannage immédiat, ces deux lignes suffisent à débloquer la situation :

```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role)
  TO anon, authenticated, service_role;
```
