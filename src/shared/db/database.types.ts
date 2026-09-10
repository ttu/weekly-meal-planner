export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      backlog_item: {
        Row: {
          added_by: string
          created_at: string
          id: string
          meal_id: string
          week_plan_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          id?: string
          meal_id: string
          week_plan_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          meal_id?: string
          week_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlog_item_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlog_item_week_plan_id_fkey"
            columns: ["week_plan_id"]
            isOneToOne: false
            referencedRelation: "week_plan"
            referencedColumns: ["id"]
          },
        ]
      }
      cook_event: {
        Row: {
          added_by: string | null
          created_at: string
          date: string
          from_backlog_item_id: string | null
          id: string
          meal_id: string
          servings_cooked: number
          slot_key: string
          week_plan_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          date: string
          from_backlog_item_id?: string | null
          id?: string
          meal_id: string
          servings_cooked: number
          slot_key: string
          week_plan_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          date?: string
          from_backlog_item_id?: string | null
          id?: string
          meal_id?: string
          servings_cooked?: number
          slot_key?: string
          week_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cook_event_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cook_event_week_plan_id_fkey"
            columns: ["week_plan_id"]
            isOneToOne: false
            referencedRelation: "week_plan"
            referencedColumns: ["id"]
          },
        ]
      }
      household: {
        Row: {
          created_at: string
          id: string
          locale: string
          name: string
          slots: Json
        }
        Insert: {
          created_at?: string
          id?: string
          locale?: string
          name: string
          slots?: Json
        }
        Update: {
          created_at?: string
          id?: string
          locale?: string
          name?: string
          slots?: Json
        }
        Relationships: []
      }
      household_member: {
        Row: {
          avatar_url: string | null
          colour: string
          created_at: string
          display_name: string
          household_id: string
          role: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          colour: string
          created_at?: string
          display_name: string
          household_id: string
          role?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          colour?: string
          created_at?: string
          display_name?: string
          household_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_member_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient: {
        Row: {
          base_unit: string
          category: string
          dimension: string
          household_id: string | null
          id: string
          slug: string
        }
        Insert: {
          base_unit: string
          category: string
          dimension: string
          household_id?: string | null
          id?: string
          slug: string
        }
        Update: {
          base_unit?: string
          category?: string
          dimension?: string
          household_id?: string | null
          id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_name: {
        Row: {
          ingredient_id: string
          locale: string
          name: string
        }
        Insert: {
          ingredient_id: string
          locale: string
          name: string
        }
        Update: {
          ingredient_id?: string
          locale?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_name_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredient"
            referencedColumns: ["id"]
          },
        ]
      }
      leftover: {
        Row: {
          cook_event_id: string
          date: string
          id: string
          slot_key: string
        }
        Insert: {
          cook_event_id: string
          date: string
          id?: string
          slot_key: string
        }
        Update: {
          cook_event_id?: string
          date?: string
          id?: string
          slot_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "leftover_cook_event_id_fkey"
            columns: ["cook_event_id"]
            isOneToOne: false
            referencedRelation: "cook_event"
            referencedColumns: ["id"]
          },
        ]
      }
      meal: {
        Row: {
          copied_from_meal_id: string | null
          created_at: string
          description: string | null
          household_id: string | null
          id: string
          name: string
          photo_url: string | null
          servings: number
          source_url: string | null
        }
        Insert: {
          copied_from_meal_id?: string | null
          created_at?: string
          description?: string | null
          household_id?: string | null
          id?: string
          name: string
          photo_url?: string | null
          servings?: number
          source_url?: string | null
        }
        Update: {
          copied_from_meal_id?: string | null
          created_at?: string
          description?: string | null
          household_id?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          servings?: number
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_copied_from_meal_id_fkey"
            columns: ["copied_from_meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_ingredient: {
        Row: {
          ingredient_id: string
          meal_id: string
          optional: boolean
          quantity: number
          unit: string
        }
        Insert: {
          ingredient_id: string
          meal_id: string
          optional?: boolean
          quantity: number
          unit: string
        }
        Update: {
          ingredient_id?: string
          meal_id?: string
          optional?: boolean
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredient_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredient_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meal"
            referencedColumns: ["id"]
          },
        ]
      }
      week_plan: {
        Row: {
          household_id: string
          id: string
          week_start: string
        }
        Insert: {
          household_id: string
          id?: string
          week_start: string
        }
        Update: {
          household_id?: string
          id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "week_plan_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      copy_catalogue_meal: {
        Args: { p_household_id: string; p_source_meal_id: string }
        Returns: string
      }
      plan_meal: {
        Args: {
          p_added_by: string
          p_backlog_item_id?: string
          p_date: string
          p_meal_id: string
          p_servings_cooked: number
          p_slot_key: string
          p_week_plan_id: string
        }
        Returns: string
      }
      save_meal: {
        Args: {
          p_household_id: string
          p_ingredients: Json
          p_meal_id?: string
          p_name: string
          p_servings: number
        }
        Returns: string
      }
      unplan_meal: { Args: { p_cook_event_id: string }; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

