-- ═══════════════════════════════════════════════════════════════════════
--  Géolocalisation des demandes et des infrastructures
-- ═══════════════════════════════════════════════════════════════════════
-- Chaque demande peut porter la position GPS exacte de l'endroit où
-- l'intervention est nécessaire (relevée par le téléphone ou le
-- navigateur du demandeur), avec la précision annoncée par l'appareil.
-- Les infrastructures reçoivent une position de référence, utilisée
-- quand la demande n'a pas été géolocalisée.
-- Les colonnes sont facultatives : les demandes existantes restent valides.

ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS latitude    numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude   numeric(9,6),
  ADD COLUMN IF NOT EXISTS precision_m numeric(8,1);

ALTER TABLE public.infrastructures
  ADD COLUMN IF NOT EXISTS latitude  numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demandes_position_valide') THEN
    ALTER TABLE public.demandes ADD CONSTRAINT demandes_position_valide CHECK (
      (latitude IS NULL AND longitude IS NULL)
      OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infrastructures_position_valide') THEN
    ALTER TABLE public.infrastructures ADD CONSTRAINT infrastructures_position_valide CHECK (
      (latitude IS NULL AND longitude IS NULL)
      OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));
  END IF;
END $$;

-- Positions de référence des infrastructures de démonstration
-- (secteur portuaire de Douala, rive gauche du Wouri).
UPDATE public.infrastructures AS i SET latitude = v.lat, longitude = v.lng
FROM (VALUES
  ('BAT-A',   4.047420, 9.694310),
  ('QUAI-1',  4.052180, 9.688640),
  ('ENTR-B',  4.058930, 9.683720),
  ('RES-EAU', 4.050300, 9.690800),
  ('EQ-GRUE', 4.052910, 9.687450),
  ('BAT-C',   4.048650, 9.692180)
) AS v(code, lat, lng)
WHERE i.code = v.code AND i.latitude IS NULL;
