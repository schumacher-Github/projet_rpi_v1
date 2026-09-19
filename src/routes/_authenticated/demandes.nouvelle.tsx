import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITES, PRIORITE_LABELS, type Priorite } from "@/lib/rpi-helpers";
import { notifySupervisors } from "@/lib/notifications";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/demandes/nouvelle")({
  head: () => ({ meta: [{ title: "Nouvelle demande — RPI-PAD" }] }),
  component: NouvelleDemande,
});

const schema = z.object({
  titre: z.string().trim().min(3, "Au moins 3 caractères").max(150),
  description: z.string().trim().min(10, "Décrivez l'incident (min. 10 caractères)").max(2000),
  priorite: z.enum(["urgente", "normale", "planifiee"]),
  infrastructure_id: z.string().uuid().nullable(),
  date_souhaitee: z.string().optional(),
});

function NouvelleDemande() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [priorite, setPriorite] = useState<Priorite>("normale");
  const [infraId, setInfraId] = useState<string>("none");
  const [dateSouhaitee, setDateSouhaitee] = useState("");

  const { data: infras = [] } = useQuery({
    queryKey: ["infrastructures-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("infrastructures")
        .select("id, code, nom")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({
      titre,
      description,
      priorite,
      infrastructure_id: infraId === "none" ? null : infraId,
      date_souhaitee: dateSouhaitee || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from("demandes")
      .insert({
        titre: parsed.data.titre,
        description: parsed.data.description,
        priorite: parsed.data.priorite,
        infrastructure_id: parsed.data.infrastructure_id,
        date_souhaitee: parsed.data.date_souhaitee || null,
        demandeur_id: user.id,
      })
      .select("id")
      .single();

    if (!error && data) {
      await supabase.from("historique").insert({
        demande_id: data.id,
        user_id: user.id,
        action: "Demande créée",
        nouveau_statut: "nouvelle",
      });

      // BF09 — notifie les chefs de service / administrateurs qu'une
      // nouvelle demande attend une priorisation / affectation.
      const prioriteLabel = PRIORITE_LABELS[parsed.data.priorite];
      void notifySupervisors(
        `Nouvelle demande (${prioriteLabel}) : ${parsed.data.titre}`,
        data.id
      );
    }

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demande enregistrée");
    navigate({ to: "/demandes/$id", params: { id: data!.id } });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/demandes">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux demandes
          </Link>
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Nouvelle demande d'intervention</h1>
        <p className="text-muted-foreground mt-1">
          Décrivez précisément l'incident ou le besoin pour permettre une prise en charge rapide.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de la demande</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="titre">Titre *</Label>
              <Input
                id="titre"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex: Climatisation HS dans le bureau D-12"
                maxLength={150}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description détaillée *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Précisez la nature du problème, sa localisation exacte, l'impact, et tout détail utile…"
                rows={6}
                maxLength={2000}
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priorité *</Label>
                <Select value={priorite} onValueChange={(v) => setPriorite(v as Priorite)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITE_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Infrastructure concernée</Label>
                <Select value={infraId} onValueChange={setInfraId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune / non précisée" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non précisée</SelectItem>
                    {infras.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.code} — {i.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date d'intervention souhaitée (optionnel)</Label>
              <Input
                id="date"
                type="date"
                value={dateSouhaitee}
                onChange={(e) => setDateSouhaitee(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enregistrer la demande
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/demandes">Annuler</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
