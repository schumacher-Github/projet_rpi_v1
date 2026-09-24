-- ═══════════════════════════════════════════════════════════════════════
--  Équipements à surveiller
-- ═══════════════════════════════════════════════════════════════════════
-- Première brique d'analyse des tendances : repérer les infrastructures
-- qui concentrent les interventions, afin d'arbitrer entre une énième
-- réparation et un remplacement. Le calcul est fait par la base, sur les
-- douze derniers mois, et non dans le navigateur.
--
-- La vue est déclarée « security_invoker » : elle s'exécute avec les
-- droits de l'utilisateur connecté, et les politiques RLS des tables
-- sous-jacentes continuent donc de s'appliquer.

CREATE OR REPLACE VIEW public.vue_equipements_surveiller
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.code,
  i.nom,
  i.type,
  count(d.id)                                        AS interventions_12m,
  count(d.id) FILTER (
    WHERE d.created_at > now() - interval '6 months') AS interventions_6m,
  count(d.id) FILTER (
    WHERE d.priorite = 'urgente')                     AS urgences_12m,
  COALESCE(sum(d.cout_estime), 0)                     AS cout_12m,
  max(d.created_at)                                   AS derniere_intervention,
  CASE
    WHEN count(d.id) > 1 THEN
      round(EXTRACT(epoch FROM (max(d.created_at) - min(d.created_at)))
            / 86400 / (count(d.id) - 1))
  END                                                 AS intervalle_moyen_jours
FROM public.infrastructures i
JOIN public.demandes d
  ON d.infrastructure_id = i.id
 AND d.created_at > now() - interval '12 months'
GROUP BY i.id, i.code, i.nom, i.type
HAVING count(d.id) >= 2
ORDER BY count(d.id) DESC, COALESCE(sum(d.cout_estime), 0) DESC;

GRANT SELECT ON public.vue_equipements_surveiller TO authenticated;

COMMENT ON VIEW public.vue_equipements_surveiller IS
  'Infrastructures ayant connu au moins deux interventions sur les douze derniers mois, avec leur coût cumulé et l''intervalle moyen entre deux pannes.';
