import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Loader2, Building2, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TYPE_INFRA_LABELS, type TypeInfra } from "@/lib/rpi-helpers";

export const Route = createFileRoute("/_authenticated/infrastructures/")({
  head: () => ({ meta: [{ title: "Infrastructures — RPI-PAD" }] }),
  component: InfrastructuresPage,
});

const schema = z.object({
  code: z.string().trim().min(2, "Min. 2 caractères").max(30).regex(/^[A-Za-z0-9_-]+$/, "Caractères autorisés : lettres, chiffres, - et _"),
  nom: z.string().trim().min(2).max(120),
  type: z.enum(["batiment", "quai", "entrepot", "reseau", "equipement", "autre"]),
  localisation: z.string().trim().max(200).optional(),
  description: z.string().trim().max(500).optional(),
});

function InfrastructuresPage() {
  const { hasAnyRole, loading } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const canManage = hasAnyRole(["admin", "chef_service"]);

  const { data: infras = [], isLoading } = useQuery({
    queryKey: ["infrastructures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("infrastructures")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async (vals: z.infer<typeof schema>) => {
      const { error } = await supabase.from("infrastructures").insert({
        code: vals.code,
        nom: vals.nom,
        type: vals.type,
        localisation: vals.localisation || null,
        description: vals.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Infrastructure ajoutée");
      qc.invalidateQueries({ queryKey: ["infrastructures"] });
      qc.invalidateQueries({ queryKey: ["infrastructures-select"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("infrastructures").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Infrastructure supprimée");
      qc.invalidateQueries({ queryKey: ["infrastructures"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return null;
  // Lecture ouverte à tous les rôles connectés (module Historique, BF07) ;
  // seules la création et la suppression restent réservées au chef de
  // service / administrateur, en cohérence avec les politiques RLS.

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Infrastructures</h1>
          <p className="text-muted-foreground mt-1">
            Référentiel des bâtiments, quais et équipements du Port Autonome de Douala.
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
            </DialogTrigger>
            <InfraDialog onSubmit={(v) => createMut.mutate(v)} loading={createMut.isPending} />
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Chargement…</div>
      ) : infras.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              Aucune infrastructure enregistrée. Ajoutez-en pour pouvoir y associer des demandes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {infras.map((i) => (
            <Card key={i.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{i.code}</div>
                    <CardTitle className="text-base mt-1">{i.nom}</CardTitle>
                  </div>
                  <Badge variant="outline">{TYPE_INFRA_LABELS[i.type]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {i.localisation && <div className="text-muted-foreground">{i.localisation}</div>}
                {i.description && <p className="text-foreground/80">{i.description}</p>}
                <div className="pt-2 flex items-center gap-1">
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/infrastructures/$id" params={{ id: i.id }}>
                      <History className="h-4 w-4 mr-1" /> Historique
                    </Link>
                  </Button>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Supprimer "${i.nom}" ?`)) deleteMut.mutate(i.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function InfraDialog({
  onSubmit,
  loading,
}: {
  onSubmit: (v: z.infer<typeof schema>) => void;
  loading: boolean;
}) {
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [type, setType] = useState<TypeInfra>("batiment");
  const [localisation, setLocalisation] = useState("");
  const [description, setDescription] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ code, nom, type, localisation: localisation || undefined, description: description || undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nouvelle infrastructure</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="code">Code *</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="QUAI-A1" required />
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={type} onValueChange={(v) => setType(v as TypeInfra)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_INFRA_LABELS) as TypeInfra[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_INFRA_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="nom">Nom *</Label>
          <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loc">Localisation</Label>
          <Input id="loc" value={localisation} onChange={(e) => setLocalisation(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
