-- Exécuté une seule fois, à la première initialisation du volume de la base.
-- Le service Realtime range ses tables internes dans le schéma « _realtime »
-- et échoue au démarrage s'il n'existe pas.
create schema if not exists _realtime;
alter schema _realtime owner to supabase_admin;
