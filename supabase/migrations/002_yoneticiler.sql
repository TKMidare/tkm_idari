-- Güncelleme 002 — yöneticiler ve silinen hesapların erişiminin anında kesilmesi
-- Mevcut veritabanında Supabase Dashboard > SQL Editor içinde bir kez çalıştırın.
--
-- ÇALIŞTIRMADAN ÖNCE: en alttaki YONETICI-EPOSTASI yazısını, ilk yönetici olacak
-- kullanıcının giriş e-postasıyla değiştirin. E-posta bulunamazsa hiçbir şey uygulanmaz.
--
-- Hiçbir kayıt silinmez veya değiştirilmez. Tamamı tek işlemdir.

begin;

-- Hesabı silinmiş bir kullanıcının elindeki oturum, süresi dolana kadar (en çok
-- 1 saat) geçerli kalırdı. Bu işlev hesabın hâlâ var olduğunu her istekte denetler.
create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users where id = (select auth.uid()));
$$;

revoke execute on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

alter policy "Giris yapan kullanicilar araclari yonetir" on public.vehicles
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

alter policy "Giris yapan kullanicilar hatlari yonetir" on public.phone_lines
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

alter policy "Giris yapan kullanicilar jeneratorleri yonetir" on public.generators
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

alter policy "Giris yapan kullanicilar gecmisi gorur" on public.audit_log
  using ((select public.is_active_user()));

-- Kullanıcı yönetimi işlevi (Edge Function), hesap açma / silme / yetki
-- değişikliklerini değişiklik geçmişine yazar.
grant insert on public.audit_log to service_role;

-- İlk yönetici. Sonraki yöneticiler sitedeki Kullanıcılar sayfasından atanır.
do $$
declare
  v_email text := 'YONETICI-EPOSTASI';
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  where lower(email) = lower(v_email);

  if not found then
    raise exception 'Kullanıcı bulunamadı: %. YONETICI-EPOSTASI yazısını gerçek giriş e-postasıyla değiştirin.', v_email;
  end if;
end;
$$;

commit;
