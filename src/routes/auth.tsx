import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Anchor, Loader2, Ship } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PiedLegal } from "@/components/page-legale";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — RPI-PAD" },
      {
        name: "description",
        content: "Connectez-vous à la plateforme RPI du Port Autonome de Douala.",
      },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(6, "Au moins 6 caractères").max(72),
});

const signupSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "Au moins 8 caractères").max(72),
  nom: z.string().trim().min(1, "Nom requis").max(100),
  prenom: z.string().trim().min(1, "Prénom requis").max(100),
  service: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [service, setService] = useState("");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setSubmitting(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials" ? "Identifiants invalides" : error.message,
      );
      return;
    }
    toast.success("Connexion réussie");
    navigate({ to: "/dashboard" });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({
      email: signupEmail,
      password: signupPassword,
      nom,
      prenom,
      service: service || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          nom: parsed.data.nom,
          prenom: parsed.data.prenom,
          service: parsed.data.service ?? "",
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Compte créé. Vous êtes connecté.");
      navigate({ to: "/dashboard" });
    } else {
      toast.success("Compte créé. Consultez votre email pour confirmer votre inscription.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left hero */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-md bg-gold flex items-center justify-center">
            <Anchor className="h-7 w-7 text-gold-foreground" />
          </div>
          <div>
            <div className="text-sm uppercase tracking-widest opacity-80">
              République du Cameroun
            </div>
            <div className="font-semibold">Port Autonome de Douala</div>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight">Gestion des interventions techniques</h1>
          <p className="mt-4 text-lg opacity-90 max-w-md">
            Plateforme officielle de la Régie du Patrimoine Immobilier (RPI) pour centraliser,
            suivre et optimiser les interventions sur les infrastructures du Port Autonome de
            Douala.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
            {[
              { label: "Demandes centralisées" },
              { label: "Priorisation" },
              { label: "Tableau de bord KPI" },
            ].map((f) => (
              <div
                key={f.label}
                className="rounded-md bg-white/10 backdrop-blur p-3 text-sm border border-white/20"
              >
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs opacity-70">
          © {new Date().getFullYear()} RPI — Port Autonome de Douala
        </div>

        <Ship className="absolute -right-10 -bottom-10 h-72 w-72 opacity-10" />
      </div>

      {/* Right form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
              <Anchor className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">RPI</div>
              <div className="font-semibold text-primary">Port Autonome de Douala</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground">Accès à la plateforme</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connectez-vous ou créez votre compte agent.
          </p>

          <Tabs defaultValue="login" className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Créer un compte</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="l-email">Email professionnel</Label>
                  <Input
                    id="l-email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="agent@pad.cm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="l-password">Mot de passe</Label>
                  <Input
                    id="l-password"
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Se connecter
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="s-prenom">Prénom</Label>
                    <Input
                      id="s-prenom"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-nom">Nom</Label>
                    <Input
                      id="s-nom"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-service">Service / Direction</Label>
                  <Input
                    id="s-service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    placeholder="Ex: Direction Exploitation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-email">Email professionnel</Label>
                  <Input
                    id="s-email"
                    type="email"
                    autoComplete="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-password">Mot de passe</Label>
                  <Input
                    id="s-password"
                    type="password"
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Minimum 8 caractères.</p>
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Créer mon compte
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Le rôle de demandeur est attribué par défaut. Un administrateur peut ensuite vous
                  attribuer un rôle technicien ou chef de service.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <PiedLegal className="mt-8" />
        </div>
      </div>
    </div>
  );
}
