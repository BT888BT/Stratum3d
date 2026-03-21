export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      orders: {
        Row: {
          id: string;
          created_at: string;
          customer_name: string;
          email: string;
          phone: string | null;
          status: string;
          currency: string;
          subtotal_cents: number;
          shipping_cents: number;
          gst_cents: number;
          total_cents: number;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          customer_name: string;
          email: string;
          phone?: string | null;
          status?: string;
          currency?: string;
          subtotal_cents?: number;
          shipping_cents?: number;
          gst_cents?: number;
          total_cents?: number;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      order_files: {
        Row: {
          id: string;
          order_id: string;
          created_at: string;
          original_filename: string;
          storage_path: string;
          mime_type: string | null;
          file_size_bytes: number;
          validation_status: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          created_at?: string;
          original_filename: string;
          storage_path: string;
          mime_type?: string | null;
          file_size_bytes: number;
          validation_status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_files"]["Insert"]>;
      };
      quote_inputs: {
        Row: {
          id: string;
          order_id: string;
          material: string;
          colour: string | null;
          layer_height_mm: number | null;
          infill_percent: number | null;
          quantity: number;
          bounding_box_x_mm: number | null;
          bounding_box_y_mm: number | null;
          bounding_box_z_mm: number | null;
          estimated_volume_cm3: number | null;
          estimated_print_time_minutes: number | null;
          shipping_method: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          material: string;
          colour?: string | null;
          layer_height_mm?: number | null;
          infill_percent?: number | null;
          quantity?: number;
          bounding_box_x_mm?: number | null;
          bounding_box_y_mm?: number | null;
          bounding_box_z_mm?: number | null;
          estimated_volume_cm3?: number | null;
          estimated_print_time_minutes?: number | null;
          shipping_method?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["quote_inputs"]["Insert"]>;
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          status: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          status: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["order_status_history"]["Insert"]
        >;
      };
    };
  };
}
