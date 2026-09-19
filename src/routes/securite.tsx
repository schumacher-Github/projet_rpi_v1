import { createFileRoute } from "@tanstack/react-router";
import { DatabaseZap, FileClock, KeyRound, LockKeyhole, Network, ShieldCheck } from "lucide-react";

import { Encadre, Liste, PageLegale, Section } from "@/components/page-legale";

export const Route = createFileRoute("/securite")({
  head: () => ({
    meta: [
      { title: "Sécurité des données — RPI-PAD" },
      {
        name: "description",
        content:
          "Mesures techniques et organisationnelles protégeant les données de la plateforme RPI-PAD.",
      },
    ],
  }),
  component: Securite,
});

const MESURES = [
  {
    icone: KeyRound,
    titre: "Authentification",
    texte:
      "Chaque accès passe par un compte nominatif. Les mots de passe sont stockés sous forme d'empreinte non réversible et ne sont consultables par personne, pas même par un administrateur. La session repose sur un jeton signé, à durée de vie limitée et renouvelé automatiquement.",
  },
  {
    icone: ShieldCheck,
    titre: "Cloisonnement par rôle",
    texte:
      "Les droits sont portés par la base de données, au moyen de politiques de sécurité au niveau des lignes. Une requête émise depuis un compte demandeur ne peut pas ramener la demande d'un autre agent, même si l'interface était contournée. Les rôles sont conservés dans une table dédiée, hors du profil, pour qu'un agent ne puisse pas s'auto-attribuer de droits.",
  },
  {
    icone: LockKeyhole,
    titre: "Chiffrement des échanges",
    texte:
      "Tous les échanges entre le poste de travail et la plateforme passent par un canal chiffré (HTTPS/TLS). Les clés de service ne sont jamais exposées au navigateur : seule une clé publique restreinte, inopérante sans session valide, est embarquée côté client.",
  },
  {
    icone: Network,
    titre: "Exposition maîtrisée",
    texte:
      "La plateforme est déployée sur le réseau interne de l'établissement, en conteneurs isolés. La base de données n'est joignable que depuis les services applicatifs ; elle n'est publiée sur aucune interface réseau accessible depuis l'extérieur.",
  },
  {
    icone: FileClock,
    titre: "Traçabilité",
    texte:
      "Chaque changement de statut, chaque affectation et chaque clôture est horodaté et rattaché à son auteur dans un journal consultable. Les enregistrements du journal ne sont ni modifiables ni supprimables depuis l'application.",
  },
  {
    icone: DatabaseZap,
    titre: "Sauvegarde et continuité",
    texte:
      "Une sauvegarde complète de la base est produite chaque jour et conservée trente jours par rotation. La procédure de restauration est documentée et testée ; le volume de données est persistant et survit au redémarrage des conteneurs.",
  },
];

function Securite() {
  return (
    <PageLegale
      titre="Sécurité des données"
      sousTitre="Les mesures techniques et organisationnelles mises en œuvre pour protéger les informations confiées à la plateforme RPI-PAD."
      maj="15 septembre 2026"
    >
      <Section titre="Mesures techniques">
        <div className="grid gap-4 sm:grid-cols-2">
          {MESURES.map((m) => (
            <div key={m.titre} className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <m.icone className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">{m.titre}</h3>
              </div>
              <p className="mt-2 text-muted-foreground">{m.texte}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section titre="Mesures organisationnelles">
        <Liste
          items={[
            "Attribution des rôles réservée à l'administrateur désigné par la Régie, sur demande hiérarchique écrite.",
            "Principe du moindre privilège : un compte ne reçoit que le rôle nécessaire à ses missions, et rien de plus.",
            "Désactivation du compte au départ de l'agent ou à son changement d'affectation.",
            "Séparation stricte des environnements : les jeux de données de démonstration ne sont jamais chargés sur la base de production.",
            "Application des mises à jour de sécurité des composants applicatifs, suivies au fil des versions.",
          ]}
        />
      </Section>

      <Section titre="Ce que l'on attend de chaque agent">
        La robustesse d'un système d'information tient autant aux usages qu'aux dispositifs
        techniques.
        <Liste
          items={[
            "Ne jamais partager ses identifiants, y compris avec un collègue ou un supérieur hiérarchique.",
            "Choisir un mot de passe d'au moins huit caractères, distinct de ceux utilisés hors du service, et le modifier depuis « Mon espace de travail » au moindre doute.",
            "Verrouiller sa session en quittant son poste.",
            "Ne pas déposer dans les rapports d'intervention d'information sans rapport avec l'intervention décrite.",
            "Signaler sans délai au responsable de la Régie toute anomalie : accès inattendu, données visibles sans raison, message suspect.",
          ]}
        />
      </Section>

      <Section titre="Signaler une faille">
        <Encadre titre="Divulgation responsable">
          Toute personne qui découvre une vulnérabilité dans la plateforme est invitée à la signaler
          au responsable de la Régie du Patrimoine Immobilier, sans la rendre publique et sans
          l'exploiter au-delà de ce qui est nécessaire pour la démontrer. Un signalement de bonne
          foi effectué dans ces conditions ne donne lieu à aucune poursuite de la part de
          l'établissement.
        </Encadre>
      </Section>

      <Section titre="Limites assumées">
        Aucune plateforme ne peut prétendre à une sécurité absolue. Les mesures décrites ici
        réduisent le risque ; elles ne l'annulent pas. En cas d'incident affectant des données à
        caractère personnel, la Régie en informe les agents concernés ainsi que sa hiérarchie,
        décrit les faits établis, les conséquences probables et les mesures prises pour y remédier.
      </Section>
    </PageLegale>
  );
}
