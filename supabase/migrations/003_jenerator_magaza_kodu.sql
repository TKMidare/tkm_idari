-- Güncelleme 003 — jeneratörlere "Mağaza Kodu" alanı
-- Mevcut veritabanında Supabase Dashboard > SQL Editor içinde bir kez çalıştırın.
--
-- Yalnızca yeni (boş) bir sütun ekler; mevcut kayıtlar değişmez.

alter table public.generators
  add column store_code text check (char_length(store_code) <= 20);
