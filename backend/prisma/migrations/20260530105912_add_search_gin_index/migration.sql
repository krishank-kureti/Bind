-- Create GIN index for full-text search on file_index searchVector
CREATE INDEX IF NOT EXISTS file_index_search_vector_idx
  ON file_index
  USING GIN ("searchVector");