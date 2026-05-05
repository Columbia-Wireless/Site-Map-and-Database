export type SiteStatus = 'active' | 'expiring_soon' | 'expired' | 'disputed' | 'pending'

export type TowerType = 'monopole' | 'lattice' | 'rooftop' | 'water_tower' | 'guyed' | 'small_cell'

export interface TowerSite {
  id: string
  site_code: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  lat: number
  lng: number
  tenant_name: string
  tenant_contact: string
  tenant_email: string
  owner_name: string
  tower_type: TowerType
  height_ft: number | null
  lease_start: string
  lease_end: string
  annual_rent: number
  escalation_rate: number
  status: SiteStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  name: string
  status: 'active' | 'inactive'
  hq_address: string
  hq_city: string
  hq_state: string
  hq_zip: string
  account_manager_name: string
  account_manager_email: string
  account_manager_phone: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ChangeLogEntry {
  id: string
  site_id: string
  field_name: string
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
}

export interface SiteDocument {
  id: string
  site_id: string
  name: string
  doc_type: 'lease' | 'amendment' | 'survey' | 'permit' | 'correspondence' | 'other'
  uploaded_by: string
  uploaded_at: string
  file_size_kb: number
}
