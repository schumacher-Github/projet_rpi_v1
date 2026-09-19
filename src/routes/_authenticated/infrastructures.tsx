import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Route de mise en page du module Infrastructures.
 *
 * Depuis l'ajout de la page « Historique par infrastructure »
 * (infrastructures.$id.tsx, besoin fonctionnel BF07), le routage par fichiers
 * de TanStack Router considère ce fichier comme la route parente de
 * /infrastructures. Elle doit donc se contenter de rendre ses routes enfants
 * via <Outlet /> :
 *
 *   infrastructures.tsx        → mise en page (ce fichier)
 *   infrastructures.index.tsx  → /infrastructures      (liste des infrastructures)
 *   infrastructures.$id.tsx    → /infrastructures/:id  (historique des interventions)
 */
export const Route = createFileRoute("/_authenticated/infrastructures")({
  component: InfrastructuresLayout,
});

function InfrastructuresLayout() {
  return <Outlet />;
}
