-- Güncelleme 003 — jeneratörlere "Mağaza Kodu", araçlara kiralama tarihleri
-- Mevcut veritabanında Supabase Dashboard > SQL Editor içinde bir kez çalıştırın.
--
-- Yalnızca yeni (boş) sütunlar ekler; mevcut kayıtlar değişmez.
-- Tamamı tek işlemdir; bir adım başarısız olursa hiçbiri uygulanmaz.

begin;

alter table public.generators
  add column store_code text check (char_length(store_code) <= 20);

alter table public.vehicles
  add column rental_start date,
  add column rental_end date,
  add constraint vehicles_rental_dates_check check (rental_end >= rental_start);

commit;
