// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string | null
          phone: string | null
          business_name: string | null
          language: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          full_name?: string | null
          phone?: string | null
          business_name?: string | null
          language?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string | null
          phone?: string | null
          business_name?: string | null
          language?: string
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          filename: string
          file_path: string
          file_size: number | null
          file_type: string | null
          upload_status: string
          processing_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          upload_status?: string
          processing_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          upload_status?: string
          processing_status?: string
          created_at?: string
          updated_at?: string
        }
      }
      extracted_data: {
        Row: {
          id: string
          user_id: string
          document_id: string | null
          processing_job_id: string | null
          data: any
          confidence: number
          is_edited: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          document_id?: string | null
          processing_job_id?: string | null
          data: any
          confidence?: number
          is_edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          document_id?: string | null
          processing_job_id?: string | null
          data?: any
          confidence?: number
          is_edited?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      processing_jobs: {
        Row: {
          id: string
          user_id: string
          document_id: string | null
          excel_sheet_id: string | null
          job_type: string
          status: string
          progress: number
          result_data: any | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          document_id?: string | null
          excel_sheet_id?: string | null
          job_type: string
          status?: string
          progress?: number
          result_data?: any | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          document_id?: string | null
          excel_sheet_id?: string | null
          job_type?: string
          status?: string
          progress?: number
          result_data?: any | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}