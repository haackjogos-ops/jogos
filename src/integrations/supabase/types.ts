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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          id: string
          location: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          id?: string
          location?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          location?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fila: {
        Row: {
          concluiu_em: string | null
          created_at: string
          id: string
          iniciou_em: string | null
          nome_usuario: string
          ordem: number
          status: Database["public"]["Enums"]["fila_status"]
          updated_at: string
          usuario_id: string
        }
        Insert: {
          concluiu_em?: string | null
          created_at?: string
          id?: string
          iniciou_em?: string | null
          nome_usuario: string
          ordem: number
          status?: Database["public"]["Enums"]["fila_status"]
          updated_at?: string
          usuario_id: string
        }
        Update: {
          concluiu_em?: string | null
          created_at?: string
          id?: string
          iniciou_em?: string | null
          nome_usuario?: string
          ordem?: number
          status?: Database["public"]["Enums"]["fila_status"]
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      queue_state: {
        Row: {
          created_at: string
          current_turn_index: number
          id: string
          time_remaining: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_turn_index?: number
          id?: string
          time_remaining?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_turn_index?: number
          id?: string
          time_remaining?: number
          updated_at?: string
        }
        Relationships: []
      }
      studies: {
        Row: {
          bible_reference: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_daily_study: boolean | null
          study_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bible_reference?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_daily_study?: boolean | null
          study_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bible_reference?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_daily_study?: boolean | null
          study_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      volleyball_queue: {
        Row: {
          created_at: string
          id: string
          is_waiting: boolean
          marked_at: string
          marked_by_user_id: string | null
          player_name: string
          position: number
          skill_level: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_waiting?: boolean
          marked_at?: string
          marked_by_user_id?: string | null
          player_name: string
          position: number
          skill_level?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_waiting?: boolean
          marked_at?: string
          marked_by_user_id?: string | null
          player_name?: string
          position?: number
          skill_level?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_volleyball_mark: {
        Args: { player_name: string; skill_level?: string }
        Returns: string
      }
      advance_fila: {
        Args: Record<PropertyKey, never>
        Returns: {
          concluiu_em: string
          id: string
          iniciou_em: string
          nome_usuario: string
          ordem: number
          remaining_seconds: number
          status: Database["public"]["Enums"]["fila_status"]
          usuario_id: string
        }[]
      }
      get_active_fila: {
        Args: Record<PropertyKey, never>
        Returns: {
          concluiu_em: string
          id: string
          iniciou_em: string
          nome_usuario: string
          ordem: number
          remaining_seconds: number
          status: Database["public"]["Enums"]["fila_status"]
          usuario_id: string
        }[]
      }
      initialize_fila_if_empty: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      fila_status: "pendente" | "ativo" | "finalizado"
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
      fila_status: ["pendente", "ativo", "finalizado"],
    },
  },
} as const
