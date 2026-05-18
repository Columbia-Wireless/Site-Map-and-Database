export type FieldType = 'text' | 'number' | 'date'
export type FilterOp  = 'eq' | 'neq' | 'ilike' | 'gte' | 'lte'

export interface FieldDef {
  key:   string
  label: string
  type:  FieldType
}

export interface FilterDef {
  field: string
  op:    FilterOp
  value: string
}

export interface ReportConfig {
  id?:         string
  name:        string
  description: string
  data_source: DataSource
  columns:     string[]
  filters:     FilterDef[]
  sort_field:  string
  sort_dir:    'asc' | 'desc'
  min_role:    string
}

export type DataSource = 'sites' | 'licensees' | 'agencies' | 'licenses' | 'audit'

export const FILTER_OPS: { value: FilterOp; label: string }[] = [
  { value: 'eq',    label: 'equals' },
  { value: 'neq',   label: 'not equals' },
  { value: 'ilike', label: 'contains' },
  { value: 'gte',   label: '≥' },
  { value: 'lte',   label: '≤' },
]

export const ROLES = ['viewer', 'reporter', 'editor', 'admin', 'super_admin']

export const FIELD_CATALOG: Record<DataSource, { label: string; fields: FieldDef[] }> = {
  sites: {
    label: 'Sites',
    fields: [
      { key: 'site_code',    label: 'Site Code',     type: 'text'   },
      { key: 'name',         label: 'Name',          type: 'text'   },
      { key: 'city',         label: 'City',          type: 'text'   },
      { key: 'state',        label: 'State',         type: 'text'   },
      { key: 'address',      label: 'Address',       type: 'text'   },
      { key: 'tower_type',   label: 'Tower Type',    type: 'text'   },
      { key: 'height_ft',    label: 'Height (ft)',   type: 'number' },
      { key: 'status',       label: 'Status',        type: 'text'   },
      { key: 'tenant_slots', label: 'Tenant Slots',  type: 'number' },
    ],
  },
  licensees: {
    label: 'Licensees',
    fields: [
      { key: 'name',                 label: 'Name',            type: 'text' },
      { key: 'hq_city',              label: 'HQ City',         type: 'text' },
      { key: 'hq_state',             label: 'HQ State',        type: 'text' },
      { key: 'status',               label: 'Status',          type: 'text' },
      { key: 'account_manager_name', label: 'Account Manager', type: 'text' },
      { key: 'account_manager_email',label: 'Manager Email',   type: 'text' },
    ],
  },
  agencies: {
    label: 'Host Agencies',
    fields: [
      { key: 'name',         label: 'Name',          type: 'text' },
      { key: 'city',         label: 'City',          type: 'text' },
      { key: 'state',        label: 'State',         type: 'text' },
      { key: 'type',         label: 'Type',          type: 'text' },
      { key: 'status',       label: 'Status',        type: 'text' },
      { key: 'contact_name', label: 'Contact Name',  type: 'text' },
      { key: 'contact_email',label: 'Contact Email', type: 'text' },
    ],
  },
  licenses: {
    label: 'Licenses',
    fields: [
      { key: 'site_name',      label: 'Site',             type: 'text'   },
      { key: 'site_code',      label: 'Site Code',        type: 'text'   },
      { key: 'licensee_name',  label: 'Licensee',         type: 'text'   },
      { key: 'status',         label: 'Status',           type: 'text'   },
      { key: 'annual_rent',    label: 'Annual Rent',      type: 'number' },
      { key: 'license_start',  label: 'Start Date',       type: 'date'   },
      { key: 'license_end',    label: 'End Date',         type: 'date'   },
      { key: 'escalation_rate',label: 'Escalation Rate',  type: 'number' },
      { key: 'mount_type',     label: 'Mount Type',       type: 'text'   },
    ],
  },
  audit: {
    label: 'Audit Log',
    fields: [
      { key: 'entity_type', label: 'Entity Type', type: 'text' },
      { key: 'field_name',  label: 'Event',       type: 'text' },
      { key: 'old_value',   label: 'Old Value',   type: 'text' },
      { key: 'new_value',   label: 'New Value',   type: 'text' },
      { key: 'changed_by',  label: 'Actor',       type: 'text' },
      { key: 'ip_address',  label: 'IP Address',  type: 'text' },
      { key: 'changed_at',  label: 'Timestamp',   type: 'date' },
    ],
  },
}
