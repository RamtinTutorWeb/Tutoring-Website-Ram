/**
 * Hand-written row types for the TutorPro Supabase schema.
 * Keep in sync with supabase/migrations/*.sql. Once a hosted project exists
 * these can be replaced by `supabase gen types typescript`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProfileRole = "student" | "admin";
export type SessionRequestStatus = "open" | "accepted" | "declined" | "scheduled";
export type BookingStatus = "scheduled" | "canceled";
export type LearnerCourseStatus = "registered" | "in-progress" | "passed";
export type WebhookProvider = "clerk" | "calendly";
export type SiteSettingKey = "content" | "selectable_options" | "session_settings";

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------
export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  role?: ProfileRole;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = Partial<ProfileInsert>;

// ---------------------------------------------------------------------------
// site_settings
// ---------------------------------------------------------------------------
export type SiteSettingRow = {
  key: string;
  content: Json;
  updated_at: string;
};

export type SiteSettingInsert = {
  key: string;
  content?: Json;
  updated_at?: string;
};

export type SiteSettingUpdate = Partial<SiteSettingInsert>;

// ---------------------------------------------------------------------------
// session_requests
// ---------------------------------------------------------------------------
export type SessionRequestRow = {
  id: string;
  student_id: string;
  subject: string | null;
  service_type: string | null;
  urgency_window: string | null;
  is_urgent: boolean;
  hard_topics: string[];
  preferred_slot: string | null;
  earliest_date: string | null;
  message: string | null;
  status: SessionRequestStatus;
  created_at: string;
  updated_at: string;
};

export type SessionRequestInsert = {
  id?: string;
  student_id: string;
  subject?: string | null;
  service_type?: string | null;
  urgency_window?: string | null;
  is_urgent?: boolean;
  hard_topics?: string[];
  preferred_slot?: string | null;
  earliest_date?: string | null;
  message?: string | null;
  status?: SessionRequestStatus;
  created_at?: string;
  updated_at?: string;
};

export type SessionRequestUpdate = Partial<SessionRequestInsert>;

// ---------------------------------------------------------------------------
// bookings
// ---------------------------------------------------------------------------
export type BookingRow = {
  id: string;
  student_id: string | null;
  request_id: string | null;
  calendly_event_uri: string;
  calendly_invitee_uri: string | null;
  invitee_email: string | null;
  invitee_name: string | null;
  event_type_name: string | null;
  start_at: string | null;
  end_at: string | null;
  status: BookingStatus;
  cancel_reason: string | null;
  raw: Json | null;
  created_at: string;
  updated_at: string;
};

export type BookingInsert = {
  id?: string;
  student_id?: string | null;
  request_id?: string | null;
  calendly_event_uri: string;
  calendly_invitee_uri?: string | null;
  invitee_email?: string | null;
  invitee_name?: string | null;
  event_type_name?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  status?: BookingStatus;
  cancel_reason?: string | null;
  raw?: Json | null;
  created_at?: string;
  updated_at?: string;
};

export type BookingUpdate = Partial<BookingInsert>;

// ---------------------------------------------------------------------------
// assessments
// ---------------------------------------------------------------------------
export type AssessmentRow = {
  id: string;
  student_id: string;
  subject: string | null;
  answers: Json;
  score: number | null;
  created_at: string;
};

export type AssessmentInsert = {
  id?: string;
  student_id: string;
  subject?: string | null;
  answers?: Json;
  score?: number | null;
  created_at?: string;
};

export type AssessmentUpdate = Partial<AssessmentInsert>;

// ---------------------------------------------------------------------------
// learner_courses
// ---------------------------------------------------------------------------
export type LearnerCourseRow = {
  id: string;
  student_id: string;
  course_id: string;
  status: LearnerCourseStatus;
  registered_at: string;
  updated_at: string;
};

export type LearnerCourseInsert = {
  id?: string;
  student_id: string;
  course_id: string;
  status?: LearnerCourseStatus;
  registered_at?: string;
  updated_at?: string;
};

export type LearnerCourseUpdate = Partial<LearnerCourseInsert>;

// ---------------------------------------------------------------------------
// webhook_events (service role only)
// ---------------------------------------------------------------------------
export type WebhookEventRow = {
  id: string;
  provider: WebhookProvider;
  event_id: string;
  event_type: string;
  payload: Json | null;
  received_at: string;
};

export type WebhookEventInsert = {
  id?: string;
  provider: WebhookProvider;
  event_id: string;
  event_type: string;
  payload?: Json | null;
  received_at?: string;
};

export type WebhookEventUpdate = Partial<WebhookEventInsert>;

// ---------------------------------------------------------------------------
// Database type for `createClient<Database>()`
// Shape follows the output of `supabase gen types typescript`.
// ---------------------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      site_settings: {
        Row: SiteSettingRow;
        Insert: SiteSettingInsert;
        Update: SiteSettingUpdate;
        Relationships: [];
      };
      session_requests: {
        Row: SessionRequestRow;
        Insert: SessionRequestInsert;
        Update: SessionRequestUpdate;
        Relationships: [
          {
            foreignKeyName: "session_requests_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      bookings: {
        Row: BookingRow;
        Insert: BookingInsert;
        Update: BookingUpdate;
        Relationships: [
          {
            foreignKeyName: "bookings_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "session_requests";
            referencedColumns: ["id"];
          }
        ];
      };
      assessments: {
        Row: AssessmentRow;
        Insert: AssessmentInsert;
        Update: AssessmentUpdate;
        Relationships: [
          {
            foreignKeyName: "assessments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      learner_courses: {
        Row: LearnerCourseRow;
        Insert: LearnerCourseInsert;
        Update: LearnerCourseUpdate;
        Relationships: [
          {
            foreignKeyName: "learner_courses_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      webhook_events: {
        Row: WebhookEventRow;
        Insert: WebhookEventInsert;
        Update: WebhookEventUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      clerk_user_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];
