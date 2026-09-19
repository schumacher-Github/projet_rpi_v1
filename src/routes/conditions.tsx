import { createFileRoute } from "@tanstack/react-router";

import { Encadre, Liste, PageLegale, Section } from "@/components/page-legale";

export const Route = createFileRoute("/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation — RPI-PAD" },
      {
        name: "description",
        content:
          "Conditions d'accès et d'usage de la plateforme RPI-PAD, responsabilités et mentions légales.",
      },
    ],
  }),
  component: Conditions,
});

function Conditions() {
  return (
    <PageLegale
      titre="Conditions d'utilisation"
      sousTitre="Règles d'accès et d'usage de la plateforme, partage des responsabilités et mentions légales."
      maj="15 septembre 2026"
    >
      <Section titre="1. Objet">
        RPI-PAD est une application de service, réservée aux agents habilités de la Régie du
        Patrimoine Immobilier du Port Autonome de Douala. Elle a pour objet unique l'enregistrement,
        l'affectation, le suivi et la clôture des demandes d'intervention technique sur les
        infrastructures portuaires. Se connecter vaut acceptation des présentes conditions.
      </Section>

      <Section titre="2. Accès">
        L'accès est nominatif et personnel. Il est accordé par l'administrateur de l'application sur
        demande hiérarchique, pour la durée de l'affectation de l'agent, et peut être suspendu à
        tout moment en cas de manquement aux présentes conditions.
      </Section>

      <Section titre="3. Usages interdits">
        Sont notamment proscrits :
        <Liste
          items={[
            "L'utilisation d'un compte autre que le sien, le prêt ou la cession de ses identifiants.",
            "Toute tentative d'accès à des données que le rôle attribué ne permet pas de consulter, ainsi que toute tentative de contournement des mécanismes d'authentification ou de cloisonnement.",
            "L'extraction, la copie ou la diffusion de données de la plateforme hors du cadre du service, sous quelque forme que ce soit.",
            "La saisie de contenus faux, injurieux, diffamatoires, ou sans lien avec une intervention technique.",
            "Toute action visant à altérer, dégrader ou rendre indisponible le service, ainsi que l'usage d'outils automatisés non autorisés.",
          ]}
        />
        <Encadre titre="Conséquences">
          Ces usages engagent la responsabilité personnelle de leur auteur. Ils exposent à des
          sanctions disciplinaires et, le cas échéant, aux poursuites prévues par la loi n° 2010/012
          du 21 décembre 2010 relative à la cybersécurité et à la cybercriminalité en République du
          Cameroun.
        </Encadre>
      </Section>

      <Section titre="4. Responsabilité de l'utilisateur">
        Chaque agent est responsable des actions effectuées sous son compte et de l'exactitude des
        informations qu'il saisit. Les décisions d'exploitation — arrêt d'un équipement, engagement
        d'une dépense, intervention sur une installation — relèvent des procédures internes de
        l'établissement et de l'appréciation des responsables compétents. Les indicateurs et
        estimations produits par la plateforme sont des aides à la décision : ils ne se substituent
        ni à une expertise technique, ni à une validation hiérarchique.
      </Section>

      <Section titre="5. Responsabilité de l'éditeur">
        La Régie met en œuvre les moyens raisonnables pour assurer la disponibilité, l'intégrité et
        l'exactitude du service. Sa responsabilité ne saurait toutefois être engagée :
        <Liste
          items={[
            "en cas d'interruption liée à la maintenance, à une panne matérielle, à une coupure d'énergie ou de réseau, ou à un cas de force majeure ;",
            "en cas de dommage résultant d'une saisie erronée, d'un usage non conforme aux présentes conditions, ou d'une décision prise sur la seule foi d'une donnée affichée sans vérification ;",
            "en cas de compromission consécutive au partage ou à la négligence dans la conservation des identifiants d'un agent ;",
            "pour les conséquences indirectes d'une indisponibilité du service, telles qu'un retard d'intervention ou une perte d'exploitation.",
          ]}
        />
      </Section>

      <Section titre="6. Propriété">
        Les données saisies, les rapports et les documents produits appartiennent au Port Autonome
        de Douala. Le code source de l'application relève du projet académique et professionnel dont
        elle est issue ; sa réutilisation, sa diffusion ou son adaptation hors du cadre de
        l'établissement requièrent l'accord préalable de la Régie.
      </Section>

      <Section titre="7. Mentions légales">
        <Liste
          items={[
            <>
              <strong>Éditeur</strong> : Régie du Patrimoine Immobilier — Port Autonome de Douala,
              République du Cameroun.
            </>,
            <>
              <strong>Nature</strong> : application interne de gestion, non ouverte au public.
            </>,
            <>
              <strong>Hébergement</strong> : infrastructure interne de l'établissement, sur le
              réseau du Port Autonome de Douala.
            </>,
            <>
              <strong>Contact</strong> : par la voie hiérarchique, auprès du responsable de la Régie
              du Patrimoine Immobilier.
            </>,
          ]}
        />
      </Section>

      <Section titre="8. Modification et droit applicable">
        Les présentes conditions peuvent être modifiées pour tenir compte de l'évolution du service
        ou de la réglementation ; la date de mise à jour figure en tête de page. Elles sont soumises
        au droit camerounais, et tout différend relève des juridictions compétentes de Douala.
      </Section>
    </PageLegale>
  );
}
