-- Crea bucket público trip-covers para fotos de portada de viajes
-- Agrega columna storage_path a document_parse_cache para deduplicación por hash SHA-256

-- 1. Bucket trip-covers (público — las portadas se muestran en la app sin auth adicional)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-covers',
  'trip-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS para trip-covers — cada usuario opera solo en su propio prefijo de ruta
CREATE POLICY "trip_covers_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trip-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "trip_covers_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trip-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "trip_covers_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'trip-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "trip_covers_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'trip-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Agregar storage_path a document_parse_cache para deduplicación
-- Cuando hay cache hit con storage_path → reusar el archivo ya subido, no re-upload
ALTER TABLE document_parse_cache
  ADD COLUMN IF NOT EXISTS storage_path TEXT;
