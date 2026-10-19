
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage RLS
CREATE POLICY "Users read own scans" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ultrasound-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own scans" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ultrasound-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own scans" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ultrasound-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
