-- TKM İdari İşler — veritabanı şeması
-- YENİ kurulum içindir: Supabase Dashboard > SQL Editor içinde bir kez çalıştırın.
-- Mevcut bir veritabanını güncellemek için supabase/migrations klasörüne bakın.

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique check (plate ~ '^[0-9A-Z ]{4,12}$'),
  -- "34ABC123" şeklinde boşluksuz aramayı mümkün kılar
  plate_compact text generated always as (replace(plate, ' ', '')) stored,
  brand text check (char_length(brand) <= 50),
  model text check (char_length(model) <= 50),
  year smallint check (year between 1950 and 2100),
  color text check (char_length(color) <= 30),
  mileage integer check (mileage between 0 and 9999999),
  fuel_type text check (fuel_type in ('Benzin', 'Dizel', 'LPG', 'Benzin + LPG', 'Hibrit', 'Elektrik')),
  status text not null default 'Aktif' check (status in ('Aktif', 'Pasif', 'Havuz')),
  chassis_no text unique check (chassis_no ~ '^[A-Z0-9]{6,17}$'),
  inspection_expiry date,
  traffic_insurance_expiry date,
  casco_expiry date,
  rental_start date,
  rental_end date,
  constraint vehicles_rental_dates_check check (rental_end >= rental_start),
  assignment_type text check (assignment_type in ('Göreve', 'Şahsa')),
  assigned_to text check (char_length(assigned_to) <= 80),
  department text check (char_length(department) <= 80),
  job_title text check (char_length(job_title) <= 80),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.phone_lines (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique check (phone_number ~ '^0[0-9]{10}$'),
  number_type text check (number_type in ('Şirket', 'Şahsi')),
  operator text check (operator in ('Turkcell', 'Vodafone', 'Türk Telekom', 'Diğer')),
  plan text check (char_length(plan) <= 80),
  quota text check (char_length(quota) <= 60),
  monthly_fee numeric(10, 2) check (monthly_fee between 0 and 999999),
  status text not null default 'Aktif' check (status in ('Aktif', 'Pasif')),
  assigned_to text check (char_length(assigned_to) <= 80),
  department text check (char_length(department) <= 80),
  job_title text check (char_length(job_title) <= 80),
  device_type text check (device_type in ('Telefon', 'Tablet')),
  imei1 text check (imei1 ~ '^[0-9]{15}$'),
  imei2 text check (imei2 ~ '^[0-9]{15}$'),
  device_brand text check (char_length(device_brand) <= 50),
  device_model text check (char_length(device_model) <= 50),
  device_serial text check (char_length(device_serial) <= 40),
  sim_serial text check (sim_serial ~ '^[0-9]{18,22}$'),
  account_holder text check (char_length(account_holder) <= 80),
  activation_date date,
  contract_end date,
  device_handover_date date,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generators (
  id uuid primary key default gen_random_uuid(),
  serial_no text not null unique check (serial_no ~ '^[A-Z0-9./-]{2,40}$'),
  brand text check (char_length(brand) <= 50),
  fuel_kind text check (char_length(fuel_kind) <= 50),
  fuel_limit numeric(10, 2) check (fuel_limit between 0 and 9999999),
  store_code text check (char_length(store_code) <= 20),
  store text check (char_length(store) <= 80),
  province text check (char_length(province) <= 40),
  district text check (char_length(district) <= 40),
  status text not null default 'Aktif' check (status in ('Aktif', 'Pasif')),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  user_email text,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Tetikleyiciler
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Her ekleme, güncelleme ve silmeyi kimin yaptığıyla birlikte kaydeder.
-- security definer: kullanıcıların audit_log üzerinde yazma yetkisi yoktur,
-- kayıt yalnızca bu tetikleyici üzerinden düşer.
create function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and v_old - 'updated_at' = v_new - 'updated_at' then
    return null;
  end if;

  insert into public.audit_log (table_name, record_id, action, old_data, new_data, user_id, user_email)
  values (
    tg_table_name,
    (coalesce(v_new, v_old) ->> 'id')::uuid,
    tg_op,
    v_old,
    v_new,
    auth.uid(),
    auth.jwt() ->> 'email'
  );
  return null;
end;
$$;

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

create trigger phone_lines_set_updated_at
  before update on public.phone_lines
  for each row execute function public.set_updated_at();

create trigger generators_set_updated_at
  before update on public.generators
  for each row execute function public.set_updated_at();

create trigger vehicles_audit
  after insert or update or delete on public.vehicles
  for each row execute function public.write_audit_log();

create trigger phone_lines_audit
  after insert or update or delete on public.phone_lines
  for each row execute function public.write_audit_log();

create trigger generators_audit
  after insert or update or delete on public.generators
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- Yetkiler ve satır düzeyi güvenlik (RLS)
-- Giriş yapmamış (anon) istekler hiçbir tabloya erişemez.
-- ---------------------------------------------------------------------------

alter table public.vehicles enable row level security;
alter table public.phone_lines enable row level security;
alter table public.generators enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.vehicles, public.phone_lines, public.generators, public.audit_log from anon, authenticated;

grant select, insert, update, delete on public.vehicles, public.phone_lines, public.generators to authenticated;
grant select on public.audit_log to authenticated;
-- Kullanıcı yönetimi işlevi (Edge Function) hesap işlemlerini geçmişe yazar.
grant insert on public.audit_log to service_role;

-- Hesabı silinmiş bir kullanıcının elindeki oturum, süresi dolana kadar geçerli
-- kalırdı. Bu işlev hesabın hâlâ var olduğunu her istekte denetler.
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

create policy "Giris yapan kullanicilar araclari yonetir"
  on public.vehicles for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

create policy "Giris yapan kullanicilar hatlari yonetir"
  on public.phone_lines for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

create policy "Giris yapan kullanicilar jeneratorleri yonetir"
  on public.generators for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

create policy "Giris yapan kullanicilar gecmisi gorur"
  on public.audit_log for select to authenticated
  using ((select public.is_active_user()));

-- ---------------------------------------------------------------------------
-- İlk yönetici
-- Kullanıcıyı Authentication > Users altında oluşturduktan sonra, aşağıdaki
-- satırı kendi e-postanızla ayrıca çalıştırın. Sonraki yöneticiler sitedeki
-- Kullanıcılar sayfasından atanır.
-- ---------------------------------------------------------------------------
--
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- where lower(email) = lower('YONETICI-EPOSTASI');
