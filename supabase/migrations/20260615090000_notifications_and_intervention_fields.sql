
-- =====================================================================
-- Ajouts fonctionnels : notifications (BF09), rapport & coût
-- d'intervention (dictionnaire de données), et historique consultable
-- par infrastructure (BF07).
-- =====================================================================

-- ── Champs "intervention" sur la demande (rapport technique + coût) ──
ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS rapport_intervention TEXT,
  ADD COLUMN IF NOT EXISTS cout_estime DECIMAL(10,2);

-- ── NOTIFICATIONS ──
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  demande_id UUID REFERENCES public.demandes(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  lu BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, lu);
CREATE INDEX IF NOT EXISTS idx_notifications_demande ON public.notifications(demande_id);

-- Chacun voit / met à jour (marque comme lues) uniquement ses propres
-- notifications ; un administrateur voit tout.
CREATE POLICY "Notifications : voir les siennes" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Notifications : marquer comme lue" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- La création d'une notification est déclenchée côté application au
-- moment d'une action sur une demande (création, affectation, changement
-- de statut) : l'émetteur n'est donc pas forcément le destinataire.
-- On autorise l'insertion à tout utilisateur connecté ; la confidentialité
-- de LECTURE reste, elle, strictement limitée au destinataire ci-dessus.
CREATE POLICY "Notifications : creation par utilisateur connecte" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Realtime (permet au NotificationBell de recevoir les nouvelles
-- notifications sans recharger la page). Protégé par un bloc DO pour ne
-- pas échouer si la table est déjà membre de la publication.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
