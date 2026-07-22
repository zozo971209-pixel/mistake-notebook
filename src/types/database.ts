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
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          mode: string
          question_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          question_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          question_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_question_owner_fk"
            columns: ["question_id", "user_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_owner_fk"
            columns: ["conversation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer_config: Json
          chapter: string | null
          correct_answer: string | null
          correct_count: number
          created_at: string
          difficulty: number | null
          error_note: string | null
          error_types: string[]
          id: string
          interval_days: number
          is_ai_generated: boolean
          is_favorite: boolean
          key_concepts: string[]
          last_reviewed_at: string | null
          mastery_score: number
          memory_tip: string | null
          next_review_at: string
          original_answer: string | null
          question_text: string
          question_type: string | null
          review_count: number
          solution_text: string | null
          source: string | null
          status: Database["public"]["Enums"]["question_status"]
          subject_id: string | null
          title: string | null
          updated_at: string
          user_id: string
          wrong_count: number
        }
        Insert: {
          answer_config?: Json
          chapter?: string | null
          correct_answer?: string | null
          correct_count?: number
          created_at?: string
          difficulty?: number | null
          error_note?: string | null
          error_types?: string[]
          id?: string
          interval_days?: number
          is_ai_generated?: boolean
          is_favorite?: boolean
          key_concepts?: string[]
          last_reviewed_at?: string | null
          mastery_score?: number
          memory_tip?: string | null
          next_review_at?: string
          original_answer?: string | null
          question_text: string
          question_type?: string | null
          review_count?: number
          solution_text?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          subject_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          wrong_count?: number
        }
        Update: {
          answer_config?: Json
          chapter?: string | null
          correct_answer?: string | null
          correct_count?: number
          created_at?: string
          difficulty?: number | null
          error_note?: string | null
          error_types?: string[]
          id?: string
          interval_days?: number
          is_ai_generated?: boolean
          is_favorite?: boolean
          key_concepts?: string[]
          last_reviewed_at?: string | null
          mastery_score?: number
          memory_tip?: string | null
          next_review_at?: string
          original_answer?: string | null
          question_text?: string
          question_type?: string | null
          review_count?: number
          solution_text?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          subject_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_subject_owner_fk"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      review_records: {
        Row: {
          duration_seconds: number | null
          id: string
          mastery_after: number
          mastery_before: number
          question_id: string
          result: Database["public"]["Enums"]["review_result"]
          reviewed_at: string
          submitted_answer: string | null
          used_hint: boolean
          user_id: string
        }
        Insert: {
          duration_seconds?: number | null
          id?: string
          mastery_after: number
          mastery_before: number
          question_id: string
          result: Database["public"]["Enums"]["review_result"]
          reviewed_at?: string
          submitted_answer?: string | null
          used_hint?: boolean
          user_id: string
        }
        Update: {
          duration_seconds?: number | null
          id?: string
          mastery_after?: number
          mastery_before?: number
          question_id?: string
          result?: Database["public"]["Enums"]["review_result"]
          reviewed_at?: string
          submitted_answer?: string | null
          used_hint?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_records_question_owner_fk"
            columns: ["question_id", "user_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      usage_records: {
        Row: {
          action_type: string
          created_at: string
          id: string
          input_tokens: number | null
          model_name: string | null
          output_tokens: number | null
          success: boolean
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model_name?: string | null
          output_tokens?: number | null
          success?: boolean
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model_name?: string | null
          output_tokens?: number | null
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ai_key_mode: Database["public"]["Enums"]["ai_key_mode"]
          created_at: string
          daily_review_target: number
          language: string
          preferred_model: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_key_mode?: Database["public"]["Enums"]["ai_key_mode"]
          created_at?: string
          daily_review_target?: number
          language?: string
          preferred_model?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_key_mode?: Database["public"]["Enums"]["ai_key_mode"]
          created_at?: string
          daily_review_target?: number
          language?: string
          preferred_model?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ai_credentials: {
        Row: {
          auth_tag: string
          created_at: string
          encrypted_key: string
          iv: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_tag: string
          created_at?: string
          encrypted_key: string
          iv: string
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_tag?: string
          created_at?: string
          encrypted_key?: string
          iv?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_ai_quota: {
        Args: { action_name: string; selected_model: string }
        Returns: boolean
      }
      delete_my_account: { Args: never; Returns: undefined }
      record_review: {
        Args: {
          answer_text?: string
          elapsed_seconds?: number
          hint_used?: boolean
          review_outcome: Database["public"]["Enums"]["review_result"]
          target_question_id: string
        }
        Returns: {
          answer_config: Json
          chapter: string | null
          correct_answer: string | null
          correct_count: number
          created_at: string
          difficulty: number | null
          error_note: string | null
          error_types: string[]
          id: string
          interval_days: number
          is_ai_generated: boolean
          is_favorite: boolean
          key_concepts: string[]
          last_reviewed_at: string | null
          mastery_score: number
          memory_tip: string | null
          next_review_at: string
          original_answer: string | null
          question_text: string
          question_type: string | null
          review_count: number
          solution_text: string | null
          source: string | null
          status: Database["public"]["Enums"]["question_status"]
          subject_id: string | null
          title: string | null
          updated_at: string
          user_id: string
          wrong_count: number
        }
        SetofOptions: {
          from: "*"
          to: "questions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      ai_key_mode: "shared" | "browser_byok"
      question_status:
        | "new"
        | "learning"
        | "reviewing"
        | "mastered"
        | "archived"
      review_result: "wrong" | "hard" | "correct" | "easy"
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
      ai_key_mode: ["shared", "browser_byok"],
      question_status: ["new", "learning", "reviewing", "mastered", "archived"],
      review_result: ["wrong", "hard", "correct", "easy"],
    },
  },
} as const
