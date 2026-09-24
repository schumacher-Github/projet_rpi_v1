import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, ClipboardList, Building2, Plus, AlertOctagon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { PRIORITE_LABELS, STATUT_LABELS, type Priorite, type Statut } from "@/lib/rpi-helpers";

/**
 * Recherche globale, accessible depuis n'importe quelle page.
 *
 * Ouverte par la loupe de l'en-tête ou par Ctrl+K (Cmd+K sur Mac), elle
 * interroge à la fois les demandes et les infrastructures, et propose
 * quelques raccourcis vers les écrans les plus demandés.
 *
 * La recherche est faite par la base, avec une limite stricte de résultats :
 * la frappe reste fluide même sur une base chargée. Les règles d'accès
 * s'appliquent comme partout ailleurs, donc chacun ne voit dans les
 * résultats que ce qu'il a le droit de consulter.
 */

interface DemandeTrouvee {
  id: string;
  reference: string;
  titre: string;
  statut: Statut;
  priorite: Priorite;
}

interface InfraTrouvee {
  id: string;
  code: string;
  nom: string;
  localisation: string | null;
}

export function RechercheGlobale() {
  const navigate = useNavigate();
  const [ouverte, setOuverte] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [terme, setTerme] = useState("");

  // Ctrl+K ou Cmd+K, où que l'on se trouve dans l'application.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOuverte((v) => !v);
      }
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, []);

  // On attend une courte pause après la frappe avant d'interroger la base.
  useEffect(() => {
    const minuteur = setTimeout(() => setTerme(saisie.trim()), 250);
    return () => clearTimeout(minuteur);
  }, [saisie]);

  const { data, isFetching } = useQuery({
    queryKey: ["recherche-globale", terme],
    enabled: ouverte && terme.length >= 2,
    queryFn: async () => {
      const motif = terme.replace(/[%,()]/g, " ");
      const [demandes, infras] = await Promise.all([
        supabase
          .from("demandes")
          .select("id, reference, titre, statut, priorite")
          .or(`reference.ilike.%${motif}%,titre.ilike.%${motif}%,description.ilike.%${motif}%`)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("infrastructures")
          .select("id, code, nom, localisation")
          .or(`code.ilike.%${motif}%,nom.ilike.%${motif}%,localisation.ilike.%${motif}%`)
          .order("nom")
          .limit(4),
      ]);
      return {
        demandes: (demandes.data ?? []) as DemandeTrouvee[],
        infras: (infras.data ?? []) as InfraTrouvee[],
      };
    },
  });

  const aller = (action: () => void) => {
    setOuverte(false);
    setSaisie("");
    setTerme("");
    action();
  };

  const demandes = data?.demandes ?? [];
  const infras = data?.infras ?? [];
  const rienTrouve = terme.length >= 2 && !isFetching && demandes.length === 0 && infras.length === 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOuverte(true)}
        className="text-muted-foreground gap-2 md:w-64 md:justify-start"
        aria-label="Rechercher dans l'application"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Rechercher…</span>
        <kbd className="ml-auto hidden md:inline rounded border border-border bg-muted px-1.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </Button>

      {/* Le filtrage est fait par la base : cmdk ne doit pas filtrer une
          seconde fois des résultats déjà sélectionnés. */}
      <CommandDialog open={ouverte} onOpenChange={setOuverte} shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher une demande, une infrastructure…"
            value={saisie}
            onValueChange={setSaisie}
          />
          <CommandList>
            {terme.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Saisissez au moins deux caractères.
              </div>
            ) : isFetching ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Recherche…</div>
            ) : null}

            {rienTrouve && <CommandEmpty>Aucun résultat pour « {terme} ».</CommandEmpty>}

            {demandes.length > 0 && (
              <CommandGroup heading="Demandes">
                {demandes.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={d.id}
                    onSelect={() =>
                      aller(() => navigate({ to: "/demandes/$id", params: { id: d.id } }))
                    }
                  >
                    <ClipboardList className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{d.titre}</span>
                    <span className="ml-auto pl-3 text-xs text-muted-foreground whitespace-nowrap">
                      {d.reference} · {PRIORITE_LABELS[d.priorite]} · {STATUT_LABELS[d.statut]}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {infras.length > 0 && (
              <CommandGroup heading="Infrastructures">
                {infras.map((i) => (
                  <CommandItem
                    key={i.id}
                    value={i.id}
                    onSelect={() =>
                      aller(() => navigate({ to: "/infrastructures/$id", params: { id: i.id } }))
                    }
                  >
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">
                      {i.code} — {i.nom}
                    </span>
                    {i.localisation && (
                      <span className="ml-auto pl-3 text-xs text-muted-foreground truncate">
                        {i.localisation}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />
            <CommandGroup heading="Raccourcis">
              {terme.length >= 2 && (
                <CommandItem
                  value="voir-tous"
                  onSelect={() => aller(() => navigate({ to: "/demandes", search: { q: terme } }))}
                >
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                  Voir toutes les demandes contenant « {terme} »
                </CommandItem>
              )}
              <CommandItem
                value="nouvelle-demande"
                onSelect={() => aller(() => navigate({ to: "/demandes/nouvelle" }))}
              >
                <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                Créer une nouvelle demande
              </CommandItem>
              <CommandItem
                value="urgences"
                onSelect={() =>
                  aller(() => navigate({ to: "/demandes", search: { priorite: "urgente" } }))
                }
              >
                <AlertOctagon className="mr-2 h-4 w-4 text-muted-foreground" />
                Voir les demandes urgentes
              </CommandItem>
              <CommandItem
                value="infrastructures"
                onSelect={() => aller(() => navigate({ to: "/infrastructures" }))}
              >
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                Ouvrir la liste des infrastructures
              </CommandItem>
            </CommandGroup>
          </CommandList>
      </CommandDialog>
    </>
  );
}
