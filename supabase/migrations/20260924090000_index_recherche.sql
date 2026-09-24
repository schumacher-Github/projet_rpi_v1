-- ═══════════════════════════════════════════════════════════════════════
--  Index de recherche et de filtrage des demandes
-- ═══════════════════════════════════════════════════════════════════════
-- La liste des demandes filtre par statut, priorité, infrastructure et
-- période, trie par date, et recherche du texte dans la référence, le
-- titre et la description. Sans index, chaque requête parcourt la table
-- entière : acceptable sur quelques dizaines de lignes, pénalisant après
-- quelques années d'exploitation.

CREATE INDEX IF NOT EXISTS demandes_created_at_idx      ON public.demandes (created_at DESC);
CREATE INDEX IF NOT EXISTS demandes_updated_at_idx      ON public.demandes (updated_at DESC);
CREATE INDEX IF NOT EXISTS demandes_statut_idx          ON public.demandes (statut);
CREATE INDEX IF NOT EXISTS demandes_priorite_idx        ON public.demandes (priorite);
CREATE INDEX IF NOT EXISTS demandes_infrastructure_idx  ON public.demandes (infrastructure_id);
CREATE INDEX IF NOT EXISTS demandes_demandeur_idx       ON public.demandes (demandeur_id);
CREATE INDEX IF NOT EXISTS demandes_technicien_idx      ON public.demandes (technicien_id);

-- Recherche textuelle insensible à la casse : la recherche « climatisation »
-- doit rester rapide même au milieu d'une description. L'extension pg_trgm
-- découpe le texte en trigrammes et rend les motifs « %mot% » indexables.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS demandes_reference_trgm_idx
  ON public.demandes USING gin (reference extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS demandes_titre_trgm_idx
  ON public.demandes USING gin (titre extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS demandes_description_trgm_idx
  ON public.demandes USING gin (description extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS historique_demande_idx ON public.historique (demande_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_idx  ON public.notifications (user_id, created_at DESC);
