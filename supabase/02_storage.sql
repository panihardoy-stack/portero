create policy "vecino sube fotos a su carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-reclamos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vecino ve sus fotos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos-reclamos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admin ve fotos de sus edificios" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos-reclamos'
    and exists (
      select 1 from public.reclamos r
      where r.foto_path = objects.name
        and public.administra_unidad(r.unidad_id)
    )
  );