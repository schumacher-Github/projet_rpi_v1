-- =====================================================================
-- Jeu de données de démonstration — RPI/PAD
--
-- C'est exactement le jeu de données qui a servi à produire les captures
-- d'écran du mémoire : sept agents couvrant les quatre rôles, six
-- infrastructures portuaires, quatorze demandes d'intervention réparties
-- sur deux mois, le journal d'une intervention en cours et les
-- notifications du chef de service.
--
-- Exécuté automatiquement par « npx supabase db reset ». Le script est
-- idempotent : le rejouer ne crée pas de doublons.
--
-- Mot de passe commun à tous les comptes : Rpi@2026
--
--   s.ngando@pad.cm     Administrateur    Serge NGANDO
--   e.biloa@pad.cm      Chef de service   Emmanuel BILOA
--   p.atangana@pad.cm   Technicien        Paul ATANGANA    (électricité)
--   r.mbida@pad.cm      Technicien        Rose MBIDA       (plomberie)
--   a.fotso@pad.cm      Technicien        Alain FOTSO      (climatisation)
--   c.nkolo@pad.cm      Demandeur         Clarisse NKOLO   (exploitation)
--   jp.ebode@pad.cm     Demandeur         Jean-Pierre EBODE (capitainerie)
--
-- Les dates sont relatives au jour d'exécution : le tableau de bord
-- affiche donc toujours une activité récente, quelle que soit la date de
-- la démonstration.
--
-- ATTENTION : réservé au développement et à la démonstration. Ne jamais
-- exécuter ce fichier sur la base de production du Port Autonome de
-- Douala.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Comptes des agents
-- ---------------------------------------------------------------------
DO $$
DECLARE
  comptes CONSTANT JSONB := $j$[
    {"email":"s.ngando@pad.cm",   "nom":"NGANDO",   "prenom":"Serge",       "role":"admin",        "service":"Direction des Systèmes d'Information",  "matricule":"PAD-03318", "tel":"+237 6 77 08 55 31"},
    {"email":"e.biloa@pad.cm",    "nom":"BILOA",    "prenom":"Emmanuel",    "role":"chef_service", "service":"Régie du Patrimoine Immobilier",        "matricule":"PAD-04127", "tel":"+237 6 99 41 20 18"},
    {"email":"p.atangana@pad.cm", "nom":"ATANGANA", "prenom":"Paul",        "role":"technicien",   "service":"Maintenance électrique",                "matricule":"PAD-05512", "tel":"+237 6 96 33 14 07"},
    {"email":"r.mbida@pad.cm",    "nom":"MBIDA",    "prenom":"Rose",        "role":"technicien",   "service":"Plomberie et réseaux hydrauliques",     "matricule":"PAD-05640", "tel":"+237 6 94 72 60 22"},
    {"email":"a.fotso@pad.cm",    "nom":"FOTSO",    "prenom":"Alain",       "role":"technicien",   "service":"Froid et climatisation",                "matricule":"PAD-05703", "tel":"+237 6 78 45 91 63"},
    {"email":"c.nkolo@pad.cm",    "nom":"NKOLO",    "prenom":"Clarisse",    "role":"demandeur",    "service":"Exploitation portuaire",                "matricule":"PAD-02891", "tel":"+237 6 90 12 44 85"},
    {"email":"jp.ebode@pad.cm",   "nom":"EBODE",    "prenom":"Jean-Pierre", "role":"demandeur",    "service":"Capitainerie",                          "matricule":"PAD-02440", "tel":"+237 6 75 30 27 49"}
  ]$j$::JSONB;
  compte JSONB;
  _id UUID;
BEGIN
  FOR compte IN SELECT * FROM jsonb_array_elements(comptes)
  LOOP
    SELECT id INTO _id FROM auth.users WHERE email = compte->>'email';

    IF _id IS NULL THEN
      _id := gen_random_uuid();

      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        _id, 'authenticated', 'authenticated',
        compte->>'email',
        extensions.crypt('Rpi@2026', extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::JSONB,
        jsonb_build_object(
          'nom', compte->>'nom',
          'prenom', compte->>'prenom',
          'telephone', compte->>'tel',
          'service', compte->>'service'
        ),
        now() - interval '300 days', now()
      );

      -- GoTrue exige une identité « email » pour autoriser la connexion
      -- par mot de passe.
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), _id,
        jsonb_build_object('sub', _id::TEXT, 'email', compte->>'email',
                           'email_verified', true),
        'email', compte->>'email',
        now(), now(), now()
      );
    END IF;

    -- Le déclencheur handle_new_user a créé le profil et un rôle par
    -- défaut : on complète l'un et on force l'autre.
    UPDATE public.profiles
       SET nom       = compte->>'nom',
           prenom    = compte->>'prenom',
           telephone = compte->>'tel',
           service   = compte->>'service',
           matricule = compte->>'matricule'
     WHERE id = _id;

    DELETE FROM public.user_roles WHERE user_id = _id;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_id, (compte->>'role')::public.app_role);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 1 bis. Normalisation des colonnes de jetons d'authentification
-- ---------------------------------------------------------------------
-- Le service d'authentification (GoTrue, écrit en Go) lit ces colonnes
-- dans des chaînes de caractères NON nullables. Un compte inséré
-- directement en SQL les laisse à NULL, et la conversion échoue à la
-- connexion : le client reçoit alors le message
-- « Database error querying schema », qui ne dit rien de la vraie cause.
--
-- On remet donc ces colonnes à la chaîne vide. Le nom des colonnes varie
-- selon la version de Supabase : chacune n'est traitée que si elle
-- existe réellement.
DO $$
DECLARE
  colonne TEXT;
BEGIN
  FOREACH colonne IN ARRAY ARRAY[
    'confirmation_token', 'recovery_token', 'email_change',
    'email_change_token_new', 'email_change_token_current',
    'phone_change', 'phone_change_token', 'reauthentication_token'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users'
        AND column_name = colonne
    ) THEN
      EXECUTE format('UPDATE auth.users SET %I = %L WHERE %I IS NULL',
                     colonne, '', colonne);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2. Référentiel des infrastructures
-- ---------------------------------------------------------------------
INSERT INTO public.infrastructures (code, nom, type, localisation, description)
VALUES
  ('BAT-A',   'Bâtiment administratif A',     'batiment',   'Zone centrale — Boulevard du Port',    'Siège administratif du port, 4 niveaux, 180 postes de travail.'),
  ('QUAI-1',  'Quai principal n°1',           'quai',       'Front de mer — Terminal à conteneurs', 'Quai de déchargement conteneurs, 320 m de linéaire.'),
  ('ENTR-B',  'Entrepôt logistique B',        'entrepot',   'Zone industrielle — Secteur 3',        'Stockage de marchandises générales, 6 200 m².'),
  ('RES-EAU', 'Réseau hydraulique principal', 'reseau',     'Ensemble du domaine portuaire',        'Canalisations, surpresseurs et pompes de relevage.'),
  ('EQ-GRUE', 'Grue portuaire G-04',          'equipement', 'Quai 1 — Poste 3',                     'Grue de levage conteneurs, capacité 40 t.'),
  ('BAT-C',   'Bâtiment technique C',         'batiment',   'Zone centrale — Arrière-quai',         'Ateliers de maintenance et magasin de pièces détachées.')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. Demandes d'intervention
-- ---------------------------------------------------------------------
-- Les dates sont exprimées en nombre de jours avant aujourd'hui, afin que
-- la démonstration présente toujours une activité récente.
INSERT INTO public.demandes (
  reference, titre, description, priorite, statut,
  infrastructure_id, demandeur_id, technicien_id,
  date_souhaitee, date_resolution, commentaire_resolution,
  rapport_intervention, cout_estime, created_at, updated_at
)
SELECT
  v.reference, v.titre, v.description,
  v.priorite::public.priorite_demande,
  v.statut::public.statut_demande,
  (SELECT i.id FROM public.infrastructures i WHERE i.code = v.infra),
  (SELECT u.id FROM auth.users u WHERE u.email = v.demandeur),
  (SELECT u.id FROM auth.users u WHERE u.email = v.technicien),
  (current_date - v.jours_souhait),
  CASE WHEN v.jours_resolution IS NULL THEN NULL
       ELSE date_trunc('day', now()) - (v.jours_resolution || ' days')::interval + interval '16 hours'
  END,
  v.commentaire, v.rapport, v.cout,
  date_trunc('day', now()) - (v.jours_creation || ' days')::interval + (v.heure_creation || ' hours')::interval,
  date_trunc('day', now()) - (COALESCE(v.jours_resolution, v.jours_creation) || ' days')::interval + interval '17 hours'
FROM (VALUES
  ('DEM-2026-0041',
   'Panne totale d''éclairage du quai 1',
   'Depuis la nuit du 6 juillet, l''ensemble des mâts d''éclairage du poste 3 est hors service. Les opérations de déchargement de nuit sont à l''arrêt et la sécurité du personnel n''est plus assurée sur la zone.',
   'urgente', 'en_cours', 'QUAI-1', 'jp.ebode@pad.cm', 'p.atangana@pad.cm',
   1, 2, 22, NULL::INT, NULL::TEXT, NULL::TEXT, NULL::NUMERIC),

  ('DEM-2026-0040',
   'Fuite sur la conduite d''alimentation de l''entrepôt B',
   'Une fuite importante est constatée au niveau du regard situé à l''entrée sud de l''entrepôt. L''eau stagne sur la voie de circulation des chariots élévateurs.',
   'urgente', 'assignee', 'RES-EAU', 'c.nkolo@pad.cm', 'r.mbida@pad.cm',
   0, 3, 7, NULL, NULL, NULL, NULL),

  ('DEM-2026-0039',
   'Climatisation défaillante — salle serveurs, bâtiment A',
   'La température de la salle serveurs dépasse 31 °C en milieu de journée. Le groupe froid n°2 ne démarre plus depuis lundi.',
   'urgente', 'nouvelle', 'BAT-A', 'c.nkolo@pad.cm', NULL,
   0, 1, 14, NULL, NULL, NULL, NULL),

  ('DEM-2026-0038',
   'Remplacement des vitrages du hall d''accueil',
   'Deux vitrages du hall présentent des fissures à la suite du coup de vent du 28 juin. Intervention à programmer hors heures d''affluence.',
   'normale', 'nouvelle', 'BAT-A', 'jp.ebode@pad.cm', NULL,
   -9, 4, 10, NULL, NULL, NULL, NULL),

  ('DEM-2026-0037',
   'Révision du limiteur de charge de la grue G-04',
   'Révision semestrielle du limiteur de charge et contrôle des fins de course, conformément au plan de maintenance préventive.',
   'planifiee', 'assignee', 'EQ-GRUE', 'jp.ebode@pad.cm', 'p.atangana@pad.cm',
   -6, 6, 9, NULL, NULL, NULL, NULL),

  ('DEM-2026-0036',
   'Réfection de l''étanchéité de la toiture de l''entrepôt B',
   'Infiltrations constatées sur la travée nord pendant les dernières pluies. Marchandises déplacées en urgence vers la travée sud.',
   'normale', 'resolue', 'ENTR-B', 'c.nkolo@pad.cm', 'r.mbida@pad.cm',
   8, 12, 8, 3,
   'Étanchéité refaite sur 140 m². Zone remise en service.',
   'Dépose du complexe d''étanchéité sur la travée nord, reprise des relevés en périphérie et pose d''une membrane bitumineuse bicouche sur 140 m². Test de mise en eau réalisé, aucune reprise d''infiltration constatée.',
   2450000),

  ('DEM-2026-0035',
   'Mise à niveau du tableau électrique TGBT du bâtiment A',
   'Déclenchements intempestifs du disjoncteur général constatés à trois reprises au cours du mois.',
   'urgente', 'cloturee', 'BAT-A', 'c.nkolo@pad.cm', 'p.atangana@pad.cm',
   14, 17, 11, 9,
   'Disjoncteur général remplacé, serrages repris sur l''ensemble du tableau.',
   'Contrôle thermographique du TGBT, remplacement du disjoncteur général 630 A et reprise des serrages sur les 24 départs. Mesures d''isolement conformes. Prochain contrôle recommandé sous six mois.',
   1875000),

  ('DEM-2026-0034',
   'Remplacement de la pompe de relevage P-02',
   'La pompe de relevage du poste sud ne démarre plus. Risque d''engorgement du réseau en cas de fortes pluies.',
   'urgente', 'cloturee', 'RES-EAU', 'jp.ebode@pad.cm', 'r.mbida@pad.cm',
   19, 21, 7, 15,
   'Pompe remplacée à l''identique, essais concluants.',
   'Dépose de la pompe P-02 (moteur grillé), pose d''une pompe neuve de même référence, reprise du câblage d''alimentation et essais de fonctionnement en charge sur deux cycles complets.',
   3120000),

  ('DEM-2026-0033',
   'Installation de détecteurs de fumée — ateliers du bâtiment C',
   'Mise en conformité du bâtiment technique : pose de détecteurs de fumée dans les trois ateliers et le magasin.',
   'planifiee', 'cloturee', 'BAT-C', 'c.nkolo@pad.cm', 'p.atangana@pad.cm',
   22, 28, 9, 18,
   '12 détecteurs posés et raccordés à la centrale incendie.',
   'Pose de 12 détecteurs optiques de fumée, raccordement à la centrale incendie existante et essais individuels par générateur de fumée. Procès-verbal de réception signé par le responsable sécurité.',
   940000),

  ('DEM-2026-0032',
   'Réparation du portail automatique — accès nord',
   'Le portail reste bloqué en position ouverte depuis une semaine.',
   'normale', 'cloturee', 'BAT-A', 'jp.ebode@pad.cm', 'a.fotso@pad.cm',
   25, 30, 13, 23,
   'Moteur et carte de commande remplacés.',
   'Diagnostic sur site : carte de commande hors service à la suite d''une surtension. Remplacement du moteur et de la carte, reprogrammation des fins de course et essais sur vingt cycles.',
   680000),

  ('DEM-2026-0031',
   'Contrôle périodique des extincteurs de l''entrepôt B',
   'Vérification annuelle réglementaire des 34 extincteurs de l''entrepôt.',
   'planifiee', 'resolue', 'ENTR-B', 'c.nkolo@pad.cm', 'a.fotso@pad.cm',
   26, 33, 8, 24,
   '34 extincteurs contrôlés, 4 recharges effectuées.',
   'Contrôle des 34 extincteurs de l''entrepôt B, recharge de 4 appareils et remplacement de 2 supports muraux. Étiquettes de vérification mises à jour.',
   415000),

  ('DEM-2026-0030',
   'Reprise du marquage au sol du terminal à conteneurs',
   'Le marquage des voies de circulation du terminal est effacé sur près de la moitié du linéaire.',
   'normale', 'rejetee', 'QUAI-1', 'jp.ebode@pad.cm', NULL,
   20, 35, 10, NULL,
   'Demande rejetée : travaux déjà inscrits au marché de réfection des voiries 2026.',
   NULL, NULL),

  ('DEM-2026-0029',
   'Nettoyage et désinfection des sanitaires du bâtiment A',
   'Intervention de remise en état des sanitaires des niveaux 2 et 3.',
   'planifiee', 'cloturee', 'BAT-A', 'c.nkolo@pad.cm', 'r.mbida@pad.cm',
   38, 41, 9, 36,
   'Sanitaires remis en état sur les deux niveaux.',
   'Remplacement de 6 robinetteries, débouchage de 3 évacuations et désinfection complète des sanitaires des niveaux 2 et 3.',
   520000),

  ('DEM-2026-0028',
   'Remplacement des projecteurs du quai 1 (tranche 1)',
   'Remplacement de 18 projecteurs à vapeur de sodium par des projecteurs LED.',
   'planifiee', 'cloturee', 'QUAI-1', 'jp.ebode@pad.cm', 'p.atangana@pad.cm',
   45, 52, 8, 42,
   '18 projecteurs LED posés, consommation divisée par deux.',
   'Dépose de 18 projecteurs à vapeur de sodium et pose de projecteurs LED 400 W sur les mâts 1 à 6. Mesures d''éclairement conformes aux valeurs requises pour le travail de nuit.',
   5640000)
) AS v(reference, titre, description, priorite, statut, infra, demandeur, technicien,
       jours_souhait, jours_creation, heure_creation, jours_resolution,
       commentaire, rapport, cout)
WHERE NOT EXISTS (
  SELECT 1 FROM public.demandes d WHERE d.reference = v.reference
);

-- ---------------------------------------------------------------------
-- 4. Journal de l'intervention en cours (DEM-2026-0041)
-- ---------------------------------------------------------------------
INSERT INTO public.historique (
  demande_id, user_id, action, ancien_statut, nouveau_statut, commentaire, created_at
)
SELECT
  (SELECT d.id FROM public.demandes d WHERE d.reference = 'DEM-2026-0041'),
  (SELECT u.id FROM auth.users u WHERE u.email = v.auteur),
  v.action,
  v.ancien::public.statut_demande,
  v.nouveau::public.statut_demande,
  v.commentaire,
  date_trunc('day', now()) - (v.jours || ' days')::interval + (v.heure || ' hours')::interval
FROM (VALUES
  ('jp.ebode@pad.cm',   'Demande créée',
   NULL::TEXT, 'nouvelle', NULL::TEXT, 2, 22),
  ('e.biloa@pad.cm',    'Priorité modifiée : Normale → Urgente',
   NULL, NULL, 'Arrêt des opérations de nuit sur le poste 3.', 2, 23),
  ('e.biloa@pad.cm',    'Technicien affecté : Paul ATANGANA',
   'nouvelle', 'assignee', NULL, 2, 23),
  ('p.atangana@pad.cm', 'Statut changé : Assignée → En cours',
   'assignee', 'en_cours', 'Diagnostic engagé sur l''armoire d''alimentation des mâts 4 à 6.', 1, 8)
) AS v(auteur, action, ancien, nouveau, commentaire, jours, heure)
WHERE EXISTS (SELECT 1 FROM public.demandes d WHERE d.reference = 'DEM-2026-0041')
  AND NOT EXISTS (
    SELECT 1 FROM public.historique h
    JOIN public.demandes d ON d.id = h.demande_id
    WHERE d.reference = 'DEM-2026-0041'
  );

-- ---------------------------------------------------------------------
-- 5. Notifications du chef de service
-- ---------------------------------------------------------------------
INSERT INTO public.notifications (user_id, demande_id, type, message, lu, created_at)
SELECT
  (SELECT u.id FROM auth.users u WHERE u.email = 'e.biloa@pad.cm'),
  (SELECT d.id FROM public.demandes d WHERE d.reference = v.reference),
  v.type, v.message, v.lu,
  date_trunc('day', now()) - (v.jours || ' days')::interval + (v.heure || ' hours')::interval
FROM (VALUES
  ('DEM-2026-0039', 'nouvelle_demande',
   'Nouvelle demande (Urgente) : Climatisation défaillante — salle serveurs, bâtiment A', FALSE, 1, 14),
  ('DEM-2026-0041', 'statut',
   'La demande DEM-2026-0041 est passée en cours de traitement.', FALSE, 1, 8),
  ('DEM-2026-0038', 'nouvelle_demande',
   'Nouvelle demande (Normale) : Remplacement des vitrages du hall d''accueil', FALSE, 4, 10),
  ('DEM-2026-0036', 'statut',
   'La demande DEM-2026-0036 est maintenant résolue.', TRUE, 3, 17)
) AS v(reference, type, message, lu, jours, heure)
WHERE NOT EXISTS (
  SELECT 1 FROM public.notifications n
  WHERE n.user_id = (SELECT u.id FROM auth.users u WHERE u.email = 'e.biloa@pad.cm')
);
