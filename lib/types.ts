export type SiteStatus = 'operational' | 'offline' | 'under_construction' | 'decommissioned'

export type OwnerType = 'municipality' | 'federal' | 'state' | 'utility' | 'private' | 'corporate' | 'nonprofit' | 'other'

export interface SiteOwner {
  id: string
  name: string
  type: OwnerType
  contact_name: string
  contact_email: string
  contact_phone: string
  address: string
  city: string
  state: string
  zip: string
  notes: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export type TenancyStatus = 'active' | 'pending' | 'expiring_soon' | 'expired' | 'terminated'

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
  host_agency_id: string | null
  tower_type: TowerType
  height_ft: number | null
  status: SiteStatus
  tenant_slots: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SiteTenancy {
  id: string
  site_id: string
  licensee_id: string
  contract_type: string
  invoice_method: string
  mount_type: string
  antenna_height_ft: number | null
  annual_rent: number
  escalation_rate: number
  license_start: string
  license_end: string
  status: TenancyStatus
  notes: string | null
  document_id: string | null
  created_at: string
  updated_at: string
  licensees?: { id: string; name: string } | null
  site_documents?: { id: string; name: string; doc_type: string; storage_path: string } | null
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

export type MediaType = 'photo' | 'video'

export interface SiteMedia {
  id: string
  site_id: string
  name: string
  media_type: MediaType
  file_path: string
  mime_type: string | null
  file_size_kb: number | null
  description: string | null
  uploaded_by: string
  uploaded_at: string
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
