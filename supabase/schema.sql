-- Tower sites
create table if not exists tower_sites (
  id uuid primary key default gen_random_uuid(),
  site_code text not null unique,
  name text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  lat double precision not null,
  lng double precision not null,
  tenant_name text not null,
  tenant_contact text not null default '',
  tenant_email text not null default '',
  owner_name text not null default '',
  tower_type text not null check (tower_type in ('monopole','lattice','rooftop','water_tower','guyed','small_cell')),
  height_ft integer,
  lease_start date not null,
  lease_end date not null,
  annual_rent numeric(10,2) not null,
  escalation_rate numeric(5,2) not null default 3.00,
  status text not null default 'active' check (status in ('active','expiring_soon','expired','disputed','pending')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Change log (audit trail)
create table if not exists site_change_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references tower_sites(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  changed_by text not null,
  changed_at timestamptz not null default now()
);

-- Documents
create table if not exists site_documents (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references tower_sites(id) on delete cascade,
  name text not null,
  doc_type text not null check (doc_type in ('lease','amendment','survey','permit','correspondence','other')),
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  file_size_kb integer not null default 0
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tower_sites_updated_at
  before update on tower_sites
  for each row execute function update_updated_at();

-- Indexes
create index if not exists idx_tower_sites_status on tower_sites(status);
create index if not exists idx_tower_sites_state on tower_sites(state);
create index if not exists idx_tower_sites_lease_end on tower_sites(lease_end);
create index if not exists idx_change_log_site_id on site_change_log(site_id);
create index if not exists idx_documents_site_id on site_documents(site_id);
