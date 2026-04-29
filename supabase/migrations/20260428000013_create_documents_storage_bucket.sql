-- Migración 13: bucket de Storage para documentos de viaje
-- Crea el bucket privado 'documents' y sus políticas RLS.
-- Solo acepta imágenes (JPEG, PNG, WebP) y PDF, máximo 10 MB por archivo.
-- Las rutas siguen el patrón: {user_id}/{document_id}/{file_name}
-- la política verifica que el primer segmento del path coincida con auth.uid().

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para storage.objects — el usuario solo accede a su carpeta
CREATE POLICY "users_select_own_documents_storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users_insert_own_documents_storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users_update_own_documents_storage"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users_delete_own_documents_storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
