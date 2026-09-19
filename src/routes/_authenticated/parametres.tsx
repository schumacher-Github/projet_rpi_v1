import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, type AppRole } from "@/hooks/use-auth";
import { useTheme, THEME_LABELS, type Theme } from "@/hooks/use-theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LIENS_LEGAUX } from "@/components/page-legale";

export const Route = createFileRoute("/_authenticated/parametres")({
  head: () => ({ meta: [{ title: "Mon espace de travail — RPI-PAD" }] }),
  component: ParametresPage,
});

const profilSchema = z.object({
  prenom: z.string().trim().min(2, "Le prénom doit comporter au moins 2 caractères").max(60),
  nom: z.string().trim().min(2, "Le nom doit comporter au moins 2 caractères").max(60),
  telephone: z.string().trim().max(30).optional(),
  service: z.string().trim().max(120).optional(),
  matricule: z.string().trim().max(40).optional(),
});

/**
 * Espace de travail de l'agent : identité, mot de passe, préférence
 * d'affichage et rappel des droits attachés à son rôle. Accessible depuis
 * le menu utilisateur et depuis la barre latérale.
 */
function ParametresPage() {
  const { user, profile, roles, refresh } = useAuth();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Mon espace de travail</h1>
        <p className="text-muted-foreground mt-1">
          Vos informations, votre mot de passe et vos préférences d'affichage.
        </p>
      </div>

      <CarteProfil
        key={profile?.id ?? "profil"}
        userId={user?.id}
        email={profile?.email ?? ""}
        initial={{
          prenom: profile?.prenom ?? "",
          nom: profile?.nom ?? "",
          telephone: profile?.telephone ?? "",
          service: profile?.service ?? "",
          matricule: profile?.matricule ?? "",
        }}
        onSaved={refresh}
      />

      <CarteMotDePasse />

      <CarteApparence />

      <CarteRoles roles={roles} />

      <CarteLegal />
    </div>
  );
}

/* ── Informations légales ────────────────────────────── */

function CarteLegal() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Informations légales
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Traitement des données, mesures de sécurité et règles d’usage de la plateforme.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
          {LIENS_LEGAUX.map((lien) => (
            <Link
              key={lien.to}
              to={lien.to}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {lien.label}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Identité ──────────────────────────────────────────────────────── */

function CarteProfil({
  userId,
  email,
  initial,
  onSaved,
}: {
  userId: string | undefined;
  email: string;
  initial: { prenom: string; nom: string; telephone: string; service: string; matricule: string };
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(
    () => setForm(initial),
    [initial.prenom, initial.nom, initial.telephone, initial.service, initial.matricule],
  );

  const champ = (cle: keyof typeof form) => ({
    value: form[cle],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [cle]: e.target.value })),
  });

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const parsed = profilSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        prenom: parsed.data.prenom,
        nom: parsed.data.nom,
        telephone: parsed.data.telephone || null,
        service: parsed.data.service || null,
        matricule: parsed.data.matricule || null,
      })
      .eq("id", userId);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    await onSaved();
    toast.success("Profil mis à jour");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="h-4 w-4 text-primary" />
          Mes informations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={enregistrer} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom *</Label>
              <Input id="prenom" {...champ("prenom")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input id="nom" {...champ("nom")} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Adresse professionnelle</Label>
            <Input id="email" value={email} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              L'adresse de connexion ne peut être modifiée que par un administrateur.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input id="telephone" placeholder="+237 6 XX XX XX XX" {...champ("telephone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matricule">Matricule</Label>
              <Input id="matricule" placeholder="PAD-00000" {...champ("matricule")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Service de rattachement</Label>
            <Input
              id="service"
              placeholder="Ex : Régie du Patrimoine Immobilier"
              {...champ("service")}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ── Mot de passe ──────────────────────────────────────────────────── */

function CarteMotDePasse() {
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);

  const changer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (motDePasse.length < 8) {
      toast.error("Le mot de passe doit comporter au moins 8 caractères");
      return;
    }
    if (motDePasse !== confirmation) {
      toast.error("Les deux saisies ne correspondent pas");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: motDePasse });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setMotDePasse("");
    setConfirmation("");
    toast.success("Mot de passe modifié");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          Sécurité
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={changer} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mdp">Nouveau mot de passe</Label>
              <Input
                id="mdp"
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mdp2">Confirmation</Label>
              <Input
                id="mdp2"
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Huit caractères au minimum. La modification prend effet immédiatement, sans déconnexion.
          </p>
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={saving || !motDePasse}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Modifier le mot de passe
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ── Apparence ─────────────────────────────────────────────────────── */

const OPTIONS_THEME: { valeur: Theme; icone: typeof Sun; aide: string }[] = [
  { valeur: "clair", icone: Sun, aide: "Bureaux éclairés" },
  { valeur: "sombre", icone: Moon, aide: "Travail de nuit" },
  { valeur: "systeme", icone: Monitor, aide: "Suit le système" },
];

function CarteApparence() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sun className="h-4 w-4 text-primary" />
          Apparence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          {OPTIONS_THEME.map(({ valeur, icone: Icone, aide }) => {
            const actif = theme === valeur;
            return (
              <button
                key={valeur}
                type="button"
                onClick={() => setTheme(valeur)}
                className={`relative rounded-md border px-4 py-3 text-left transition-colors ${
                  actif ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"
                }`}
              >
                {actif && <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />}
                <Icone className="h-5 w-5 mb-2 text-muted-foreground" />
                <div className="text-sm font-medium">{THEME_LABELS[valeur]}</div>
                <div className="text-xs text-muted-foreground">{aide}</div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Ce réglage est propre au poste de travail utilisé ; il n'affecte pas les autres agents.
        </p>
      </CardContent>
    </Card>
  );
}

/* ── Rôles et droits ───────────────────────────────────────────────── */

const DROITS: Record<AppRole, string> = {
  admin:
    "Accès complet : gestion des comptes et des rôles, du référentiel des infrastructures et de toutes les demandes.",
  chef_service:
    "Priorisation et affectation des interventions, tableau de bord, historique par infrastructure et gestion du référentiel.",
  technicien:
    "Traitement des interventions qui vous sont affectées : mise à jour du statut, rapport et coût de clôture.",
  demandeur:
    "Soumission de demandes d'intervention et suivi de leur avancement jusqu'à la clôture.",
};

function CarteRoles({ roles }: { roles: AppRole[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Mon rôle et mes droits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun rôle ne vous est encore attribué. Rapprochez-vous de l'administrateur de
            l'application.
          </p>
        ) : (
          roles.map((role) => (
            <div key={role} className="rounded-md border border-border p-3">
              <Badge variant="outline" className="mb-2">
                {ROLE_LABELS[role]}
              </Badge>
              <p className="text-sm text-muted-foreground">{DROITS[role]}</p>
            </div>
          ))
        )}
        <p className="text-xs text-muted-foreground">
          Seul un administrateur peut modifier les rôles, depuis l'écran « Utilisateurs ».
        </p>
      </CardContent>
    </Card>
  );
}
