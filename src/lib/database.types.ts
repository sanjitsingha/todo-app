/**
 * The app's tables in Supabase, as the client sees them. Written to match
 * supabase/migrations (20261117120000_todos_and_settings.sql, 20261119120000_google_calendar.sql);
 * keep them in step. Timestamps come back as ISO strings, dates as "YYYY-MM-DD", times of day
 * as "HH:mm". The Google token tables there are server only, so they aren't here.
 */

export type Priority = 'high' | 'medium' | 'low';
export type FeedbackModeColumn = 'vibrate' | 'tick' | 'tickVibrate' | 'none';
export type TodoViewColumn = 'list' | 'timeline';
export type AppearanceColumn = 'light' | 'dark' | 'system';

export type TodoRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  reminder_time: string | null;
  duration: number | null;
  priority: Priority;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** `updated_at` is stamped by the server on every write. */
export type TodoInsert = Omit<TodoRow, 'updated_at'> & { updated_at?: string };

export type UserSettingsRow = {
  user_id: string;
  feedback: FeedbackModeColumn;
  todo_view: TodoViewColumn;
  appearance: AppearanceColumn;
  updated_at: string;
};

export type UserSettingsInsert = Omit<UserSettingsRow, 'updated_at'> & { updated_at?: string };

/** Read only for the app: the google-calendar Edge Function writes it. */
export type CalendarConnectionRow = {
  user_id: string;
  connected: boolean;
  google_email: string | null;
  calendar_id: string | null;
  time_zone: string;
  synced_until: string | null;
  synced_until_id: string | null;
  fresh_calendar: boolean;
  /** 'revoked' or 'calendar_deleted' when it stopped by itself. */
  last_error: string | null;
  /** Todo sync: todos are sent to the Dooist calendar. */
  sync_todos: boolean;
  /** Events: the person's Google Calendar events show in Dooist. */
  show_events: boolean;
  /** Google gave Dooist permission to read events. */
  can_read_events: boolean;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      todos: {
        Row: TodoRow;
        Insert: TodoInsert;
        Update: Partial<TodoInsert>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettingsRow;
        Insert: UserSettingsInsert;
        Update: Partial<UserSettingsInsert>;
        Relationships: [];
      };
      calendar_connections: {
        Row: CalendarConnectionRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
