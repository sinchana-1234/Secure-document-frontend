export interface SourceRef {
  ref: number;
  document_id: number | null;
  title: string | null;
  doc_type: string | null;
  chunk_index: number | null;
  score: number;
  snippet: string;
}

export interface SearchResponse {
  answer: string;
  sources: SourceRef[];
}

export interface SearchRequest {
  question: string;
  top_k?: number;
  doc_type?: string;
  tags?: string[];
}