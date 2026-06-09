export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      demandes: {
        Row: {
          commentaire_resolution: string | null
          created_at: string
          date_resolution: string | null
          date_souhaitee: string | null
          demandeur_id: string
          description: string
          id: string
          infrastructure_id: string | null
          priorite: Database["public"]["Enums"]["priorite_demande"]
          reference: string
          statut: Database["public"]["Enums"]["statut_demande"]
          technicien_id: string | null
          titre: string
          updated_at: string
        }
        Insert: {
          commentaire_resolution?: string | null
          created_at?: string
          date_resolution?: string | null
          date_souhaitee?: string | null
          demandeur_id: string
          description: string
          id?: string
          infrastructure_id?: string | null
          priorite?: Database["public"]["Enums"]["priorite_demande"]
          reference?: string
          statut?: Database["public"]["Enums"]["statut_demande"]
          technicien_id?: string | null
          titre: string
          updated_at?: string
        }
        Update: {
          commentaire_resolution?: string | null
          created_at?: string
          date_resolution?: string | null
          date_souhaitee?: string | null
          demandeur_id?: string
          description?: string
          id?: string
          infrastructure_id?: string | null
          priorite?: Database["public"]["Enums"]["priorite_demande"]
          reference?: string
          statut?: Database["public"]["Enums"]["statut_demande"]
          technicien_id?: string | null
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandes_infrastructure_id_fkey"
            columns: ["infrastructure_id"]
            isOneToOne: false
            referencedRelation: "infrastructures"
            referencedColumns: ["id"]
          },
        ]
      }
      historique: {
        Row: {
          action: string
          ancien_statut: Database["public"]["Enums"]["statut_demande"] | null
          commentaire: string | null
          created_at: string
          demande_id: string
          id: string
          nouveau_statut: Database["public"]["Enums"]["statut_demande"] | null
          user_id: string | null
        }
        Insert: {
          action: string
          ancien_statut?: Database["public"]["Enums"]["statut_demande"] | null
          commentaire?: string | null
          created_at?: string
          demande_id: string
          id?: string
          nouveau_statut?: Database["public"]["Enums"]["statut_demande"] | null
          user_id?: string | null
        }
        Update: {
          action?: string
          ancien_statut?: Database["public"]["Enums"]["statut_demande"] | null
          commentaire?: string | null
          created_at?: string
          demande_id?: string
          id?: string
          nouveau_statut?: Database["public"]["Enums"]["statut_demande"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historique_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes"
            referencedColumns: ["id"]
          },
        ]
      }
      infrastructures: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          localisation: string | null
          nom: string
          type: Database["public"]["Enums"]["type_infrastructure"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          localisation?: string | null
          nom: string
          type?: Database["public"]["Enums"]["type_infrastructure"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          localisation?: string | null
          nom?: string
          type?: Database["public"]["Enums"]["type_infrastructure"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          matricule: string | null
          nom: string
          prenom: string
          service: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          matricule?: string | null
          nom: string
          prenom: string
          service?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          matricule?: string | null
          nom?: string
          prenom?: string
          service?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "chef_service" | "technicien" | "demandeur"
      priorite_demande: "urgente" | "normale" | "planifiee"
      statut_demande:
        | "nouvelle"
        | "assignee"
        | "en_cours"
        | "resolue"
        | "cloturee"
        | "rejetee"
      type_infrastructure:
        | "batiment"
        | "quai"
        | "entrepot"
        | "reseau"
        | "equipement"
        | "autre"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "chef_service", "technicien", "demandeur"],
      priorite_demande: ["urgente", "normale", "planifiee"],
      statut_demande: [
        "nouvelle",
        "assignee",
        "en_cours",
        "resolue",
        "cloturee",
        "rejetee",
      ],
      type_infrastructure: [
        "batiment",
        "quai",
        "entrepot",
        "reseau",
        "equipement",
        "autre",
      ],
    },
  },
} as const
