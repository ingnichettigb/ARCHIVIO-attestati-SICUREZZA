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
      categorie_corso: {
        Row: {
          macro_categoria: string
          updated_at: string
          visibile_lavoratore: boolean
        }
        Insert: {
          macro_categoria: string
          updated_at?: string
          visibile_lavoratore?: boolean
        }
        Update: {
          macro_categoria?: string
          updated_at?: string
          visibile_lavoratore?: boolean
        }
        Relationships: []
      }
      classi_concorso: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string
          da_lavoratore: boolean
          denominazione: string | null
          id: string
          usi: number
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string
          da_lavoratore?: boolean
          denominazione?: string | null
          id?: string
          usi?: number
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string
          da_lavoratore?: boolean
          denominazione?: string | null
          id?: string
          usi?: number
        }
        Relationships: []
      }
      dipendenti: {
        Row: {
          classe_concorso: string | null
          codice_fiscale: string
          cognome: string
          created_at: string
          data_nascita: string | null
          email: string | null
          id: string
          luogo_nascita: string | null
          materia: string | null
          nome: string
          reparto: string | null
          sottoreparto: string | null
          updated_at: string
        }
        Insert: {
          classe_concorso?: string | null
          codice_fiscale: string
          cognome: string
          created_at?: string
          data_nascita?: string | null
          email?: string | null
          id?: string
          luogo_nascita?: string | null
          materia?: string | null
          nome: string
          reparto?: string | null
          sottoreparto?: string | null
          updated_at?: string
        }
        Update: {
          classe_concorso?: string | null
          codice_fiscale?: string
          cognome?: string
          created_at?: string
          data_nascita?: string | null
          email?: string | null
          id?: string
          luogo_nascita?: string | null
          materia?: string | null
          nome?: string
          reparto?: string | null
          sottoreparto?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documenti_attestati: {
        Row: {
          codice_fiscale: string
          created_at: string
          data_scadenza: string
          dipendente_id: string
          id: string
          nome_file: string
          percorso_file: string
          tipo_attestato: string
          tipo_personalizzato: string | null
          updated_at: string
        }
        Insert: {
          codice_fiscale: string
          created_at?: string
          data_scadenza: string
          dipendente_id: string
          id?: string
          nome_file: string
          percorso_file: string
          tipo_attestato: string
          tipo_personalizzato?: string | null
          updated_at?: string
        }
        Update: {
          codice_fiscale?: string
          created_at?: string
          data_scadenza?: string
          dipendente_id?: string
          id?: string
          nome_file?: string
          percorso_file?: string
          tipo_attestato?: string
          tipo_personalizzato?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documenti_attestati_dipendente_id_fkey"
            columns: ["dipendente_id"]
            isOneToOne: false
            referencedRelation: "dipendenti"
            referencedColumns: ["id"]
          },
        ]
      }
      materie: {
        Row: {
          attivo: boolean
          classe_concorso: string | null
          created_at: string
          da_lavoratore: boolean
          id: string
          nome: string
          usi: number
        }
        Insert: {
          attivo?: boolean
          classe_concorso?: string | null
          created_at?: string
          da_lavoratore?: boolean
          id?: string
          nome: string
          usi?: number
        }
        Update: {
          attivo?: boolean
          classe_concorso?: string | null
          created_at?: string
          da_lavoratore?: boolean
          id?: string
          nome?: string
          usi?: number
        }
        Relationships: []
      }
      reparti: {
        Row: {
          attivo: boolean
          created_at: string
          id: string
          nome: string
          ordine: number
          richiede_classe_concorso: boolean
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordine?: number
          richiede_classe_concorso?: boolean
        }
        Update: {
          attivo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordine?: number
          richiede_classe_concorso?: boolean
        }
        Relationships: []
      }
      sottoreparti: {
        Row: {
          attivo: boolean
          codice: string | null
          created_at: string
          id: string
          nome: string
          ordine: number
          reparto_id: string
        }
        Insert: {
          attivo?: boolean
          codice?: string | null
          created_at?: string
          id?: string
          nome: string
          ordine?: number
          reparto_id: string
        }
        Update: {
          attivo?: boolean
          codice?: string | null
          created_at?: string
          id?: string
          nome?: string
          ordine?: number
          reparto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sottoreparti_reparto_id_fkey"
            columns: ["reparto_id"]
            isOneToOne: false
            referencedRelation: "reparti"
            referencedColumns: ["id"]
          },
        ]
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
      registra_classe_concorso: {
        Args: { p_codice: string; p_denominazione?: string }
        Returns: undefined
      }
      registra_materia: {
        Args: { p_classe?: string; p_nome: string }
        Returns: undefined
      }
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
