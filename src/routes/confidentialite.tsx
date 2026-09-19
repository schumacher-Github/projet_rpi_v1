import { createFileRoute } from "@tanstack/react-router";

import { Encadre, Liste, PageLegale, Section } from "@/components/page-legale";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — RPI-PAD" },
      {
        name: "description",
        content:
          "Données collectées par la plateforme RPI-PAD, finalités, durées de conservation et droits des agents.",
      },
    ],
  }),
  component: Confidentialite,
});

function Confidentialite() {
  return (
    <PageLegale
      titre="Politique de confidentialité"
      sousTitre="Ce que la plateforme RPI-PAD enregistre, pourquoi elle l'enregistre, combien de temps elle le conserve et ce que chaque agent peut exiger."
      maj="15 septembre 2026"
    >
      <Section titre="1. Qui traite les données">
        La plateforme RPI-PAD est un outil de travail interne de la Régie du Patrimoine Immobilier
        (RPI) du Port Autonome de Douala. Le responsable du traitement est la Régie du Patrimoine
        Immobilier, établie au Port Autonome de Douala, République du Cameroun. Les données sont
        hébergées sur les serveurs de l'établissement et ne sont ni vendues, ni louées, ni
        communiquées à des tiers commerciaux.
      </Section>

      <Section titre="2. Données collectées">
        La plateforme ne collecte que ce dont la gestion des interventions a besoin.
        <Liste
          items={[
            <>
              <strong>Identification de l'agent</strong> : nom, prénom, adresse professionnelle,
              service de rattachement, matricule, téléphone professionnel, rôle attribué.
            </>,
            <>
              <strong>Authentification</strong> : empreinte du mot de passe (le mot de passe en
              clair n'est jamais stocké ni consultable), date de dernière connexion.
            </>,
            <>
              <strong>Activité métier</strong> : demandes d'intervention déposées, infrastructures
              concernées, priorités, affectations, rapports d'intervention, coûts, pièces jointes et
              commentaires.
            </>,
            <>
              <strong>Traçabilité</strong> : journal des changements de statut, horodaté et rattaché
              à l'agent qui les a effectués.
            </>,
          ]}
        />
        Aucune donnée de localisation, aucune donnée de santé, aucune donnée bancaire et aucun
        traceur publicitaire ne sont collectés. La plateforme ne dépose pas de cookie de mesure
        d'audience : seul un jeton de session, strictement nécessaire au fonctionnement, est
        conservé sur le poste de travail.
      </Section>

      <Section titre="3. Finalités">
        <Liste
          items={[
            "Enregistrer et suivre les demandes d'intervention sur les infrastructures portuaires.",
            "Affecter les interventions aux techniciens compétents et en mesurer les délais.",
            "Produire les indicateurs de pilotage de la Régie (volumes, délais, taux de résolution).",
            "Garantir la traçabilité des décisions prises sur chaque demande.",
            "Sécuriser l'accès à l'application et détecter les usages anormaux.",
          ]}
        />
        Les données ne sont utilisées pour aucune autre finalité, et notamment pour aucune
        évaluation individuelle automatisée des agents.
      </Section>

      <Section titre="4. Qui voit quoi">
        Le cloisonnement n'est pas une question de présentation : il est appliqué par la base de
        données elle-même, pour chaque requête et pour chaque ligne.
        <Liste
          items={[
            <>
              Un <strong>demandeur</strong> ne voit que les demandes qu'il a déposées.
            </>,
            <>
              Un <strong>technicien</strong> ne voit que les interventions qui lui sont affectées.
            </>,
            <>
              Un <strong>chef de service</strong> voit l'ensemble des demandes de la Régie, à des
              fins de priorisation et de pilotage.
            </>,
            <>
              Un <strong>administrateur</strong> ajoute à cela la gestion des comptes et des rôles.
            </>,
          ]}
        />
      </Section>

      <Section titre="5. Durée de conservation">
        <Liste
          items={[
            "Compte agent : pendant toute la durée de l'affectation, puis désactivation au départ de l'agent.",
            "Demandes d'intervention et rapports : cinq ans après la clôture, au titre du suivi patrimonial des infrastructures.",
            "Journal de traçabilité : douze mois glissants.",
            "Sauvegardes : trente jours de rétention, par rotation.",
          ]}
        />
        À l'issue de ces durées, les données sont supprimées ou anonymisées de manière irréversible.
      </Section>

      <Section titre="6. Droits des agents">
        Conformément à la réglementation camerounaise applicable à la protection des données à
        caractère personnel et à la sécurité des systèmes d'information — notamment la loi n°
        2010/012 du 21 décembre 2010 relative à la cybersécurité et à la cybercriminalité — chaque
        agent dispose d'un droit d'accès, de rectification, d'opposition et de limitation sur les
        données qui le concernent.
        <Liste
          items={[
            <>
              Les informations de profil sont rectifiables directement depuis l'écran
              <em> Mon espace de travail</em>.
            </>,
            "Toute autre demande s'adresse au responsable de la Régie du Patrimoine Immobilier, par la voie hiérarchique habituelle.",
            "Une réponse est apportée dans un délai de trente jours.",
          ]}
        />
        <Encadre titre="Limite à connaître">
          Le droit à l'effacement ne s'applique pas aux demandes d'intervention clôturées ni au
          journal de traçabilité : ces éléments constituent la mémoire technique du patrimoine
          portuaire et leur conservation répond à une obligation de service.
        </Encadre>
      </Section>

      <Section titre="7. Sous-traitants">
        L'envoi des notifications par courriel peut être confié à un prestataire technique
        d'acheminement. Dans ce cas, seules l'adresse professionnelle du destinataire et la
        référence de la demande lui sont transmises — jamais le contenu métier détaillé. Aucun autre
        service tiers n'est appelé par l'application.
      </Section>

      <Section titre="8. Évolution de cette politique">
        Toute modification substantielle est portée à la connaissance des agents par la voie
        hiérarchique et la date de mise à jour indiquée en tête de page est modifiée en conséquence.
      </Section>
    </PageLegale>
  );
}
