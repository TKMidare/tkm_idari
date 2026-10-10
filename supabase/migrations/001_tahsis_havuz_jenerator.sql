-- Güncelleme 001 — tahsis türü, havuz araç, numara / cihaz türü, jeneratörler
-- Mevcut veritabanında Supabase Dashboard > SQL Editor içinde bir kez çalıştırın.
--
-- Hiçbir kayıt silinmez veya değiştirilmez: yalnızca yeni (boş) sütunlar ve yeni
-- bir tablo eklenir. Tamamı tek işlemdir; bir adım başarısız olursa hiçbiri uygulanmaz.

begin;

-- Araçlar: tahsis türü ve "Havuz" durumu
alter table public.vehicles
  add column assignment_type text check (assignment_type in ('Göreve', 'Şahsa'));

alter table public.vehicles drop constraint vehicles_status_check;
alter table public.vehicles
  add constraint vehicles_status_check check (status in ('Aktif', 'Pasif', 'Havuz'));

-- Telefon hatları: numara türü ve verilen cihazın türü
alter table public.phone_lines
  add column number_type text check (number_type in ('Şirket', 'Şahsi')),
  add column device_type text check (device_type in ('Telefon', 'Tablet'));

-- Jeneratörler
create table public.generators (
  id uuid primary key default gen_random_uuid(),
  serial_no text not null unique check (serial_no ~ '^[A-Z0-9./-]{2,40}$'),
  brand text check (char_length(brand) <= 50),
  fuel_kind text check (char_length(fuel_kind) <= 50),
  fuel_limit numeric(10, 2) check (fuel_limit between 0 and 9999999),
  store text check (char_length(store) <= 80),
  province text check (char_length(province) <= 40),
  district text check (char_length(district) <= 40),
  status text not null default 'Aktif' check (status in ('Aktif', 'Pasif')),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger generators_set_updated_at
  before update on public.generators
  for each row execute function public.set_updated_at();

create trigger generators_audit
  after insert or update or delete on public.generators
  for each row execute function public.write_audit_log();

alter table public.generators enable row level security;

revoke all on public.generators from anon, authenticated;
grant select, insert, update, delete on public.generators to authenticated;

create policy "Giris yapan kullanicilar jeneratorleri yonetir"
  on public.generators for all to authenticated
  using (true) with check (true);

commit;
