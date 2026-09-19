
-- Permettre aux administrateurs de gérer les rôles utilisateurs
CREATE POLICY "Roles : admin insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Roles : admin delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Données de démonstration pour les infrastructures (si table vide)
INSERT INTO public.infrastructures (code, nom, type, localisation, description)
SELECT v.code, v.nom, v.type, v.localisation, v.description
FROM (VALUES
  ('BAT-A', 'Bâtiment administratif A', 'batiment'::public.type_infrastructure, 'Zone centrale', 'Siège administratif du port'),
  ('QUAI-1', 'Quai principal n°1', 'quai'::public.type_infrastructure, 'Front de mer', 'Quai de déchargement conteneurs'),
  ('ENTR-B', 'Entrepôt logistique B', 'entrepot'::public.type_infrastructure, 'Zone industrielle', 'Stockage marchandises générales'),
  ('RES-EAU', 'Réseau hydraulique principal', 'reseau'::public.type_infrastructure, 'Infrastructure portuaire', 'Canalisations et pompes'),
  ('EQ-GRUE', 'Grue portuaire G-04', 'equipement'::public.type_infrastructure, 'Quai 1', 'Grue de levage conteneurs')
) AS v(code, nom, type, localisation, description)
WHERE NOT EXISTS (SELECT 1 FROM public.infrastructures LIMIT 1);
