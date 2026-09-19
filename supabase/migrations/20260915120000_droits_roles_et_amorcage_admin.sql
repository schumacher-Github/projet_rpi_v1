-- =====================================================================
-- Droits d'exécution des fonctions de sécurité + amorçage du premier
-- administrateur.
--
-- Deux problèmes sont corrigés ici.
--
-- 1. « permission denied for function has_role »
--    Toutes les politiques RLS du projet appellent public.has_role().
--    Cette fonction est bien SECURITY DEFINER, mais cela ne dispense pas
--    l'appelant d'avoir le droit EXECUTE dessus : selon la configuration
--    du projet, le droit accordé par défaut à PUBLIC peut avoir été
--    révoqué. Le rôle « authenticated » se voit alors refuser l'exécution
--    au moment même où la politique s'évalue, et TOUTE lecture échoue.
--    On accorde donc explicitement EXECUTE aux rôles applicatifs.
--
-- 2. Impossibilité de se connecter en administrateur
--    Le déclencheur handle_new_user attribuait le rôle « demandeur » à
--    tout nouveau compte, sans exception : aucun administrateur ne
--    pouvait donc exister, et personne ne pouvait en promouvoir un,
--    puisque seul un administrateur peut attribuer les rôles. Le premier
--    compte créé sur une base vierge devient désormais administrateur.
--
-- Migration idempotente : elle peut être rejouée sans dommage.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Droits sur le schéma et les fonctions
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_updated_at_column()
  TO anon, authenticated, service_role;

-- Les fonctions créées par la suite dans public hériteront de ce droit,
-- ce qui évite que le problème ne réapparaisse à la prochaine migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Le premier compte inscrit devient administrateur
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  premier_compte BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, nom, prenom, email, telephone, service)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'telephone',
    NEW.raw_user_meta_data->>'service'
  );

  -- Amorçage : sur une base encore vierge de tout rôle, le compte qui
  -- s'inscrit est nécessairement celui de l'agent qui installe
  -- l'application. Il reçoit le rôle d'administrateur, ce qui lui permet
  -- ensuite d'attribuer leurs rôles aux autres agents depuis l'écran
  -- « Utilisateurs ». Tous les comptes suivants sont des demandeurs.
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO premier_compte;

  -- Le transtypage explicite est nécessaire : une expression CASE produit
  -- du texte, que PL/pgSQL ne convertit pas seul vers le type énuméré.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    (CASE WHEN premier_compte THEN 'admin' ELSE 'demandeur' END)::public.app_role
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user()
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Promotion manuelle d'un agent en administrateur
-- ---------------------------------------------------------------------
-- Utilitaire de dépannage, à exécuter depuis l'éditeur SQL (ou psql) par
-- un administrateur de la base. Il reste volontairement hors de portée
-- des rôles applicatifs : il n'est PAS exécutable depuis l'application.
CREATE OR REPLACE FUNCTION public.promouvoir_administrateur(_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = lower(_email);

  IF _user_id IS NULL THEN
    RETURN format('Aucun compte ne correspond à %s.', _email);
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN format('%s est désormais administrateur.', _email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promouvoir_administrateur(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promouvoir_administrateur(TEXT) FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Notification des superviseurs sans exposer la table des rôles
-- ---------------------------------------------------------------------
-- À la création d'une demande, l'application notifie les chefs de service
-- et les administrateurs. Côté client, cela supposait de lire la table
-- des rôles pour connaître leurs identifiants — ce qu'un demandeur n'a
-- pas le droit de faire, si bien qu'aucune notification n'était créée.
-- Le calcul est donc déplacé dans la base : la fonction ci-dessous
-- s'exécute avec les droits de son propriétaire, insère une notification
-- pour chaque superviseur, et ne révèle jamais la composition des rôles.
CREATE OR REPLACE FUNCTION public.notifier_superviseurs(
  _message TEXT,
  _demande_id UUID DEFAULT NULL,
  _type TEXT DEFAULT 'info'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _inserees INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  INSERT INTO public.notifications (user_id, demande_id, type, message)
  SELECT DISTINCT ur.user_id, _demande_id, _type, _message
  FROM public.user_roles ur
  WHERE ur.role IN ('chef_service', 'admin')
    AND ur.user_id <> auth.uid();

  GET DIAGNOSTICS _inserees = ROW_COUNT;
  RETURN _inserees;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notifier_superviseurs(TEXT, UUID, TEXT)
  TO authenticated, service_role;
