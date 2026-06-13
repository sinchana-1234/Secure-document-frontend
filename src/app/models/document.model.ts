export interface DocumentOut {
  id: number;
  original_filename: string;
  title: string | null;
  doc_type: string;
  size_bytes: number;
  tags: string[] | null;
  page_count: number | null;
  num_chunks: number | null;
  ocr_used: string | null;
  status: string;                // indexed | processing | failed | duplicate | pending
  error_message: string | null;
  duplicate_of_id: number | null;
  owner_id: number;
  upload_date: string;
}