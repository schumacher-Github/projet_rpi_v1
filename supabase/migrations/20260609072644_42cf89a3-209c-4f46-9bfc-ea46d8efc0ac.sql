
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'chef_service', 'technicien', 'demandeur');
CREATE TYPE public.priorite_demande AS ENUM ('urgente', 'normale', 'planifiee');
CREATE TYPE public.statut_demande AS ENUM ('nouvelle', 'assignee', 'en_cours', 'resolue', 'cloturee', 'rejetee');
CREATE TYPE public.type_infrastructure AS ENUM ('batiment', 'quai', 'entrepot', 'reseau', 'equipement', 'autre');

-- TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  service TEXT,
  matricule TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER_ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- HAS_ROLE FUNCTION
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- INFRASTRUCTURES
CREATE TABLE public.infrastructures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  type public.type_infrastructure NOT NULL DEFAULT 'autre',
  localisation TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.infrastructures TO authenticated;
GRANT ALL ON public.infrastructures TO service_role;
ALTER TABLE public.infrastructures ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_infra_updated_at BEFORE UPDATE ON public.infrastructures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DEMANDES
CREATE TABLE public.demandes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('RPI-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 6)),
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  priorite public.priorite_demande NOT NULL DEFAULT 'normale',
  statut public.statut_demande NOT NULL DEFAULT 'nouvelle',
  infrastructure_id UUID REFERENCES public.infrastructures(id) ON DELETE SET NULL,
  demandeur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  technicien_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date_souhaitee DATE,
  date_resolution TIMESTAMPTZ,
  commentaire_resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandes TO authenticated;
GRANT ALL ON public.demandes TO service_role;
ALTER TABLE public.demandes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_demandes_updated_at BEFORE UPDATE ON public.demandes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_demandes_demandeur ON public.demandes(demandeur_id);
CREATE INDEX idx_demandes_technicien ON public.demandes(technicien_id);
CREATE INDEX idx_demandes_statut ON public.demandes(statut);
CREATE INDEX idx_demandes_priorite ON public.demandes(priorite);
CREATE INDEX idx_demandes_infrastructure ON public.demandes(infrastructure_id);

-- HISTORIQUE
CREATE TABLE public.historique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id UUID NOT NULL REFERENCES public.demandes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  ancien_statut public.statut_demande,
  nouveau_statut public.statut_demande,
  commentaire TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.historique TO authenticated;
GRANT ALL ON public.historique TO service_role;
ALTER TABLE public.historique ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_historique_demande ON public.historique(demande_id);

-- =================== POLICIES ===================

-- profiles : chacun voit son profil; admin voit tout
CREATE POLICY "Profils : voir le sien" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chef_service'));
CREATE POLICY "Profils : modifier le sien" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profils : creation par utilisateur" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Profils : admin supprime" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles : voir le sien, admin gère tout
CREATE POLICY "Roles : voir les siens" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chef_service'));

-- infrastructures : tout connecté lit; admin/chef gèrent
CREATE POLICY "Infra : lecture" ON public.infrastructures
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Infra : insert admin/chef" ON public.infrastructures
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chef_service'));
CREATE POLICY "Infra : update admin/chef" ON public.infrastructures
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chef_service'));
CREATE POLICY "Infra : delete admin" ON public.infrastructures
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- demandes
CREATE POLICY "Demandes : lecture selon role" ON public.demandes
  FOR SELECT TO authenticated USING (
    auth.uid() = demandeur_id
    OR auth.uid() = technicien_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'chef_service')
  );
CREATE POLICY "Demandes : creation par demandeur" ON public.demandes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = demandeur_id);
CREATE POLICY "Demandes : update selon role" ON public.demandes
  FOR UPDATE TO authenticated USING (
    auth.uid() = demandeur_id
    OR auth.uid() = technicien_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'chef_service')
  );
CREATE POLICY "Demandes : suppression admin" ON public.demandes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- historique
CREATE POLICY "Historique : lecture si on voit la demande" ON public.historique
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.demandes d
      WHERE d.id = historique.demande_id
      AND (
        d.demandeur_id = auth.uid()
        OR d.technicien_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'chef_service')
      )
    )
  );
CREATE POLICY "Historique : insertion connecte" ON public.historique
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- =================== AUTO PROFILE + ROLE ON SIGNUP ===================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
  -- Default role: demandeur
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'demandeur');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
