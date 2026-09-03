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
      attestati_caricati: {
        Row: {
          codice_fiscale: string
          created_at: string
          data_corso: string
          data_scadenza_calcolata: string | null
          data_validazione: string | null
          dipendente_id: string
          id: string
          note_rifiuto: string | null
          ore_dichiarate: number | null
          stato_validazione: string
          tipo_corso_id: string
          updated_at: string
          url_foto_fronte: string | null
          url_foto_retro: string | null
        }
        Insert: {
          codice_fiscale: string
          created_at?: string
          data_corso: string
          data_scadenza_calcolata?: string | null
          data_validazione?: string | null
          dipendente_id: string
          id?: string
          note_rifiuto?: string | null
          ore_dichiarate?: number | null
          stato_validazione?: string
          tipo_corso_id: string
          updated_at?: string
          url_foto_fronte?: string | null
          url_foto_retro?: string | null
        }
        Update: {
          codice_fiscale?: string
          created_at?: string
          data_corso?: string
          data_scadenza_calcolata?: string | null
          data_validazione?: string | null
          dipendente_id?: string
          id?: string
          note_rifiuto?: string | null
          ore_dichiarate?: number | null
          stato_validazione?: string
          tipo_corso_id?: string
          updated_at?: string
          url_foto_fronte?: string | null
          url_foto_retro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attestati_caricati_codice_fiscale_fkey"
            columns: ["codice_fiscale"]
            isOneToOne: false
            referencedRelation: "dipendenti"
            referencedColumns: ["codice_fiscale"]
          },
          {
            foreignKeyName: "attestati_caricati_dipendente_id_fkey"
            columns: ["dipendente_id"]
            isOneToOne: false
            referencedRelation: "dipendenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestati_caricati_tipo_corso_id_fkey"
            columns: ["tipo_corso_id"]
            isOneToOne: false
            referencedRelation: "tipi_corso"
            referencedColumns: ["id"]
          },
        ]
      }
      dipendenti: {
        Row: {
          codice_fiscale: string
          cognome: string
          created_at: string
          data_nascita: string | null
          email: string | null
          id: string
          luogo_nascita: string | null
          nome: string
          reparto: string | null
          updated_at: string
        }
        Insert: {
          codice_fiscale: string
          cognome: string
          created_at?: string
          data_nascita?: string | null
          email?: string | null
          id?: string
          luogo_nascita?: string | null
          nome: string
          reparto?: string | null
          updated_at?: string
        }
        Update: {
          codice_fiscale?: string
          cognome?: string
          created_at?: string
          data_nascita?: string | null
          email?: string | null
          id?: string
          luogo_nascita?: string | null
          nome?: string
          reparto?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tipi_corso: {
        Row: {
          created_at: string
          durata_validita_anni: number | null
          id: string
          livello_specifico: string
          macro_categoria: string
          nome_corso: string
          ore_minime_legge: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          durata_validita_anni?: number | null
          id?: string
          livello_specifico: string
          macro_categoria: string
          nome_corso: string
          ore_minime_legge?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          durata_validita_anni?: number | null
          id?: string
          livello_specifico?: string
          macro_categoria?: string
          nome_corso?: string
          ore_minime_legge?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
