// GENERADO A PARTIR DE LAS MIGRACIONES — equivalente a:
// supabase gen types typescript --local > packages/types/database.ts
// Regenerar cuando se añadan migraciones nuevas.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          plan: Database['public']['Enums']['user_plan']
          ai_messages_used_this_month: number
          ai_messages_limit: number
          ai_messages_reset_at: string
          preferred_currency: string
          preferred_language: string
          onboarding_completed: boolean
          timezone: string
          travel_interests: string[]
          preferred_pace: Database['public']['Enums']['travel_pace'] | null
          preferred_budget: Database['public']['Enums']['budget_tier'] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          plan?: Database['public']['Enums']['user_plan']
          ai_messages_used_this_month?: number
          ai_messages_limit?: number
          ai_messages_reset_at?: string
          preferred_currency?: string
          preferred_language?: string
          onboarding_completed?: boolean
          timezone?: string
          travel_interests?: string[]
          preferred_pace?: Database['public']['Enums']['travel_pace'] | null
          preferred_budget?: Database['public']['Enums']['budget_tier'] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          plan?: Database['public']['Enums']['user_plan']
          ai_messages_used_this_month?: number
          ai_messages_limit?: number
          ai_messages_reset_at?: string
          preferred_currency?: string
          preferred_language?: string
          onboarding_completed?: boolean
          timezone?: string
          travel_interests?: string[]
          preferred_pace?: Database['public']['Enums']['travel_pace'] | null
          preferred_budget?: Database['public']['Enums']['budget_tier'] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          cover_image_url: string | null
          status: Database['public']['Enums']['trip_status']
          destinations: Json
          start_date: string | null
          end_date: string | null
          travelers_count: number
          pace: Database['public']['Enums']['travel_pace'] | null
          budget: Database['public']['Enums']['budget_tier'] | null
          base_currency: string
          total_budget: number | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          cover_image_url?: string | null
          status?: Database['public']['Enums']['trip_status']
          destinations?: Json
          start_date?: string | null
          end_date?: string | null
          travelers_count?: number
          pace?: Database['public']['Enums']['travel_pace'] | null
          budget?: Database['public']['Enums']['budget_tier'] | null
          base_currency?: string
          total_budget?: number | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          cover_image_url?: string | null
          status?: Database['public']['Enums']['trip_status']
          destinations?: Json
          start_date?: string | null
          end_date?: string | null
          travelers_count?: number
          pace?: Database['public']['Enums']['travel_pace'] | null
          budget?: Database['public']['Enums']['budget_tier'] | null
          base_currency?: string
          total_budget?: number | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trips_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      itineraries: {
        Row: {
          id: string
          trip_id: string
          user_id: string
          status: Database['public']['Enums']['itinerary_status']
          graph: Json
          generated_by: string
          user_prompt: string
          generation_tokens_used: number | null
          destination_timezone: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          user_id: string
          status?: Database['public']['Enums']['itinerary_status']
          graph?: Json
          generated_by?: string
          user_prompt?: string
          generation_tokens_used?: number | null
          destination_timezone?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          user_id?: string
          status?: Database['public']['Enums']['itinerary_status']
          graph?: Json
          generated_by?: string
          user_prompt?: string
          generation_tokens_used?: number | null
          destination_timezone?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'itineraries_trip_id_fkey'
            columns: ['trip_id']
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'itineraries_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      expenses: {
        Row: {
          id: string
          trip_id: string
          user_id: string
          description: string
          amount: number
          currency: string
          amount_in_base_currency: number | null
          category: Database['public']['Enums']['expense_category']
          input_method: Database['public']['Enums']['expense_input_method']
          spent_at: string
          location: string | null
          notes: string | null
          receipt_storage_path: string | null
          local_timezone: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          user_id: string
          description: string
          amount: number
          currency?: string
          amount_in_base_currency?: number | null
          category?: Database['public']['Enums']['expense_category']
          input_method?: Database['public']['Enums']['expense_input_method']
          spent_at?: string
          location?: string | null
          notes?: string | null
          receipt_storage_path?: string | null
          local_timezone?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          user_id?: string
          description?: string
          amount?: number
          currency?: string
          amount_in_base_currency?: number | null
          category?: Database['public']['Enums']['expense_category']
          input_method?: Database['public']['Enums']['expense_input_method']
          spent_at?: string
          location?: string | null
          notes?: string | null
          receipt_storage_path?: string | null
          local_timezone?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_trip_id_fkey'
            columns: ['trip_id']
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      documents: {
        Row: {
          id: string
          user_id: string
          trip_id: string | null
          title: string
          type: Database['public']['Enums']['document_type']
          storage_path: string
          file_name: string
          file_size_bytes: number | null
          mime_type: string | null
          extracted_data: Json
          issue_date: string | null
          expiry_date: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trip_id?: string | null
          title: string
          type?: Database['public']['Enums']['document_type']
          storage_path: string
          file_name: string
          file_size_bytes?: number | null
          mime_type?: string | null
          extracted_data?: Json
          issue_date?: string | null
          expiry_date?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          trip_id?: string | null
          title?: string
          type?: Database['public']['Enums']['document_type']
          storage_path?: string
          file_name?: string
          file_size_bytes?: number | null
          mime_type?: string | null
          extracted_data?: Json
          issue_date?: string | null
          expiry_date?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documents_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_trip_id_fkey'
            columns: ['trip_id']
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          trip_id: string | null
          type: Database['public']['Enums']['notification_type']
          title: string
          body: string
          trigger_at: string
          sent_at: string | null
          read_at: string | null
          push_token: string | null
          data: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trip_id?: string | null
          type?: Database['public']['Enums']['notification_type']
          title: string
          body: string
          trigger_at?: string
          sent_at?: string | null
          read_at?: string | null
          push_token?: string | null
          data?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          trip_id?: string | null
          type?: Database['public']['Enums']['notification_type']
          title?: string
          body?: string
          trigger_at?: string
          sent_at?: string | null
          read_at?: string | null
          push_token?: string | null
          data?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_trip_id_fkey'
            columns: ['trip_id']
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      itinerary_cache: {
        Row: {
          id: string
          user_id: string
          trip_id: string
          graph: Json
          user_prompt: string
          generated_by: string
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trip_id: string
          graph?: Json
          user_prompt?: string
          generated_by?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          trip_id?: string
          graph?: Json
          user_prompt?: string
          generated_by?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'itinerary_cache_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'itinerary_cache_trip_id_fkey'
            columns: ['trip_id']
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
        ]
      }
      ai_feedback: {
        Row: {
          id: string
          user_id: string
          trip_id: string | null
          itinerary_id: string | null
          node_id: string | null
          action: Database['public']['Enums']['ai_feedback_action']
          original_content: Json
          modified_content: Json
          user_comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trip_id?: string | null
          itinerary_id?: string | null
          node_id?: string | null
          action: Database['public']['Enums']['ai_feedback_action']
          original_content?: Json
          modified_content?: Json
          user_comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          trip_id?: string | null
          itinerary_id?: string | null
          node_id?: string | null
          action?: Database['public']['Enums']['ai_feedback_action']
          original_content?: Json
          modified_content?: Json
          user_comment?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_feedback_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      document_parse_cache: {
        Row: {
          id: string
          file_hash: string
          result: Json
          storage_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          file_hash: string
          result?: Json
          storage_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          file_hash?: string
          result?: Json
          storage_path?: string | null
          created_at?: string
        }
        Relationships: []
      }
      expense_parse_cache: {
        Row: {
          id: string
          text_hash: string
          result: Json
          created_at: string
        }
        Insert: {
          id?: string
          text_hash: string
          result?: Json
          created_at?: string
        }
        Update: {
          id?: string
          text_hash?: string
          result?: Json
          created_at?: string
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
      trip_status: 'planning' | 'confirmed' | 'active' | 'completed' | 'cancelled'
      user_plan: 'free' | 'pro' | 'team'
      travel_pace: 'slow' | 'moderate' | 'intense'
      budget_tier: 'budget' | 'mid' | 'premium' | 'luxury'
      expense_category:
        | 'transport'
        | 'accommodation'
        | 'food'
        | 'activities'
        | 'shopping'
        | 'health'
        | 'communication'
        | 'other'
      expense_input_method: 'manual' | 'ocr' | 'ai_parsed'
      document_type:
        | 'passport'
        | 'visa'
        | 'flight'
        | 'hotel'
        | 'insurance'
        | 'car_rental'
        | 'tour'
        | 'other'
      notification_type:
        | 'trip_reminder'
        | 'flight_alert'
        | 'document_expiry'
        | 'itinerary_ready'
        | 'expense_limit'
        | 'general'
      itinerary_status: 'draft' | 'reviewing' | 'approved' | 'saved'
      ai_feedback_action: 'approved' | 'rejected' | 'modified' | 'regenerated'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helpers de conveniencia — mismos que genera el CLI de Supabase
type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never
