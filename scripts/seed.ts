import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const tenants = [
  'AT&T Mobility', 'Verizon Wireless', 'T-Mobile USA', 'Crown Castle',
  'American Tower', 'SBA Communications', 'US Cellular', 'Dish Network',
  'FirstNet', 'Lumen Technologies',
]

const owners = [
  'Broadstone REIT', 'Starwood Capital Group', 'Blackstone Real Estate',
  'Prologis', 'Boston Properties', 'ETV Capital Partners',
  'Harrison Street Real Estate', 'Ares Management',
]

const towerTypes = ['monopole', 'lattice', 'rooftop', 'water_tower', 'guyed', 'small_cell']

const locations = [
  { city: 'Silver Spring', state: 'MD', zip: '20901', lat: 39.0028, lng: -76.9880 },
  { city: 'Bethesda', state: 'MD', zip: '20814', lat: 38.9807, lng: -77.1003 },
  { city: 'Rockville', state: 'MD', zip: '20850', lat: 39.0840, lng: -77.1528 },
  { city: 'Gaithersburg', state: 'MD', zip: '20877', lat: 39.1434, lng: -77.2014 },
  { city: 'Annapolis', state: 'MD', zip: '21401', lat: 38.9784, lng: -76.4922 },
  { city: 'Frederick', state: 'MD', zip: '21701', lat: 39.4143, lng: -77.4105 },
  { city: 'Hagerstown', state: 'MD', zip: '21740', lat: 39.6418, lng: -77.7199 },
  { city: 'Arlington', state: 'VA', zip: '22201', lat: 38.8816, lng: -77.0910 },
  { city: 'Alexandria', state: 'VA', zip: '22301', lat: 38.8048, lng: -77.0469 },
  { city: 'Fairfax', state: 'VA', zip: '22030', lat: 38.8462, lng: -77.3064 },
  { city: 'Reston', state: 'VA', zip: '20190', lat: 38.9586, lng: -77.3570 },
  { city: 'Richmond', state: 'VA', zip: '23219', lat: 37.5407, lng: -77.4360 },
  { city: 'Virginia Beach', state: 'VA', zip: '23451', lat: 36.8529, lng: -75.9780 },
  { city: 'Norfolk', state: 'VA', zip: '23510', lat: 36.8508, lng: -76.2859 },
  { city: 'Washington', state: 'DC', zip: '20001', lat: 38.9072, lng: -77.0369 },
  { city: 'Washington', state: 'DC', zip: '20020', lat: 38.8462, lng: -76.9935 },
  { city: 'Baltimore', state: 'MD', zip: '21201', lat: 39.2904, lng: -76.6122 },
  { city: 'Columbia', state: 'MD', zip: '21044', lat: 39.2037, lng: -76.8610 },
  { city: 'Greenbelt', state: 'MD', zip: '20770', lat: 39.0046, lng: -76.8755 },
  { city: 'Laurel', state: 'MD', zip: '20707', lat: 39.0993, lng: -76.8483 },
  { city: 'Bowie', state: 'MD', zip: '20715', lat: 38.9429, lng: -76.7791 },
  { city: 'Waldorf', state: 'MD', zip: '20601', lat: 38.6243, lng: -76.9061 },
  { city: 'Leonardtown', state: 'MD', zip: '20650', lat: 38.2929, lng: -76.6341 },
  { city: 'Cumberland', state: 'MD', zip: '21502', lat: 39.6529, lng: -78.7625 },
  { city: 'Easton', state: 'MD', zip: '21601', lat: 38.7740, lng: -76.0763 },
  { city: 'Salisbury', state: 'MD', zip: '21801', lat: 38.3607, lng: -75.5994 },
  { city: 'Ocean City', state: 'MD', zip: '21842', lat: 38.3365, lng: -75.0849 },
  { city: 'Charlottesville', state: 'VA', zip: '22902', lat: 38.0293, lng: -78.4767 },
  { city: 'Lynchburg', state: 'VA', zip: '24501', lat: 37.4138, lng: -79.1422 },
  { city: 'Roanoke', state: 'VA', zip: '24011', lat: 37.2710, lng: -79.9414 },
  { city: 'Fredericksburg', state: 'VA', zip: '22401', lat: 38.3032, lng: -77.4605 },
  { city: 'Manassas', state: 'VA', zip: '20110', lat: 38.7509, lng: -77.4753 },
  { city: 'Herndon', state: 'VA', zip: '20170', lat: 38.9696, lng: -77.3861 },
  { city: 'McLean', state: 'VA', zip: '22101', lat: 38.9340, lng: -77.1773 },
  { city: 'Tysons', state: 'VA', zip: '22182', lat: 38.9204, lng: -77.2311 },
  { city: 'Woodbridge', state: 'VA', zip: '22191', lat: 38.6593, lng: -77.2497 },
  { city: 'Stafford', state: 'VA', zip: '22554', lat: 38.4220, lng: -77.4080 },
  { city: 'Dumfries', state: 'VA', zip: '22026', lat: 38.5651, lng: -77.3294 },
  { city: 'Leesburg', state: 'VA', zip: '20175', lat: 39.1157, lng: -77.5636 },
  { city: 'Winchester', state: 'VA', zip: '22601', lat: 39.1857, lng: -78.1634 },
  { city: 'Harrisonburg', state: 'VA', zip: '22801', lat: 38.4496, lng: -78.8689 },
  { city: 'Staunton', state: 'VA', zip: '24401', lat: 38.1496, lng: -79.0717 },
  { city: 'Waynesboro', state: 'VA', zip: '22980', lat: 38.0685, lng: -78.8895 },
  { city: 'Culpeper', state: 'VA', zip: '22701', lat: 38.4732, lng: -77.9961 },
  { city: 'Warrenton', state: 'VA', zip: '20186', lat: 38.7218, lng: -77.7975 },
  { city: 'Front Royal', state: 'VA', zip: '22630', lat: 38.9182, lng: -78.1942 },
  { city: 'Martinsburg', state: 'WV', zip: '25401', lat: 39.4562, lng: -77.9639 },
  { city: 'Charles Town', state: 'WV', zip: '25414', lat: 39.2876, lng: -77.8597 },
  { city: 'Hagerstown', state: 'MD', zip: '21742', lat: 39.6418, lng: -77.7199 },
  { city: 'Gettysburg', state: 'PA', zip: '17325', lat: 39.8309, lng: -77.2311 },
  { city: 'York', state: 'PA', zip: '17401', lat: 39.9626, lng: -76.7277 },
  { city: 'Lancaster', state: 'PA', zip: '17601', lat: 40.0379, lng: -76.3055 },
  { city: 'Wilmington', state: 'DE', zip: '19801', lat: 39.7447, lng: -75.5484 },
  { city: 'Dover', state: 'DE', zip: '19901', lat: 39.1582, lng: -75.5244 },
  { city: 'Annapolis Junction', state: 'MD', zip: '20701', lat: 39.1174, lng: -76.7777 },
  { city: 'Elkridge', state: 'MD', zip: '21075', lat: 39.2165, lng: -76.7238 },
  { city: 'Glen Burnie', state: 'MD', zip: '21061', lat: 39.1629, lng: -76.6249 },
  { city: 'Towson', state: 'MD', zip: '21204', lat: 39.4015, lng: -76.6019 },
  { city: 'Timonium', state: 'MD', zip: '21093', lat: 39.4357, lng: -76.6188 },
  { city: 'Owings Mills', state: 'MD', zip: '21117', lat: 39.4137, lng: -76.7802 },
]

const streets = [
  'Tower Rd', 'Industrial Blvd', 'Commerce Dr', 'Technology Pkwy', 'Highland Ave',
  'Ridge Rd', 'Valley View Dr', 'Summit St', 'Wireless Way', 'Antenna Blvd',
  'Spectrum Dr', 'Broadband Ln', 'Cellular Ave', 'Signal Hill Rd', 'Relay Rd',
]

const contacts = [
  { name: 'Michael Chen', email: 'mchen@att.com' },
  { name: 'Sarah Williams', email: 'swilliams@verizon.com' },
  { name: 'James Rodriguez', email: 'jrodriguez@tmobile.com' },
  { name: 'Emily Thompson', email: 'ethompson@crowncastle.com' },
  { name: 'Robert Kim', email: 'rkim@americantower.com' },
  { name: 'Lisa Johnson', email: 'ljohnson@sbasite.com' },
  { name: 'David Park', email: 'dpark@uscellular.com' },
  { name: 'Amanda Foster', email: 'afoster@dish.com' },
]

const changeUsers = ['M. Callahan', 'J. Rivera', 'T. Oberlin', 'K. Walsh', 'Admin']

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function deriveStatus(leaseEnd: Date): string {
  const now = new Date()
  const daysOut = (leaseEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (daysOut < 0) return 'expired'
  if (daysOut < 180) return 'expiring_soon'
  if (Math.random() < 0.03) return 'disputed'
  return 'active'
}

async function seed() {
  console.log('Clearing existing data...')
  await supabase.from('site_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('site_change_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('tower_sites').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('Seeding tower sites...')
  const sites = locations.map((loc, i) => {
    const leaseStart = new Date(2010 + randInt(0, 10), randInt(0, 11), 1)
    const leaseTerm = randInt(10, 25)
    const leaseEnd = addYears(leaseStart, leaseTerm)
    const contact = rand(contacts)
    const streetNum = randInt(100, 9999)
    const street = rand(streets)
    const jitter = (Math.random() - 0.5) * 0.05

    return {
      site_code: `CWF-${String(i + 1).padStart(4, '0')}`,
      name: `${loc.city} ${rand(['Tower', 'Site', 'Facility', 'Installation'])} ${String.fromCharCode(65 + (i % 26))}`,
      address: `${streetNum} ${street}`,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      lat: loc.lat + jitter,
      lng: loc.lng + jitter,
      tenant_name: rand(tenants),
      tenant_contact: contact.name,
      tenant_email: contact.email,
      owner_name: rand(owners),
      tower_type: rand(towerTypes),
      height_ft: rand(towerTypes) === 'rooftop' || rand(towerTypes) === 'small_cell' ? null : randInt(80, 350),
      lease_start: fmtDate(leaseStart),
      lease_end: fmtDate(leaseEnd),
      annual_rent: randInt(18000, 95000),
      escalation_rate: parseFloat((randInt(20, 40) / 10).toFixed(1)),
      status: deriveStatus(leaseEnd),
      notes: Math.random() < 0.3 ? rand([
        'Renewal negotiations in progress.',
        'Structural inspection due Q3.',
        'Tenant requested equipment upgrade — under review.',
        'Rent dispute — legal review initiated.',
        'Access easement amendment pending signature.',
      ]) : null,
    }
  })

  const { data: insertedSites, error } = await supabase
    .from('tower_sites')
    .insert(sites)
    .select('id, site_code')

  if (error) { console.error('Site insert error:', error); return }
  console.log(`Inserted ${insertedSites!.length} sites`)

  // Seed change log for each site
  const changeLogs = []
  const docInserts = []

  for (const site of insertedSites!) {
    const numChanges = randInt(2, 8)
    const fields = ['annual_rent', 'status', 'tenant_contact', 'lease_end', 'notes', 'escalation_rate']
    const baseDate = new Date(2022, 0, 1)

    for (let i = 0; i < numChanges; i++) {
      const field = rand(fields)
      const daysAgo = randInt(0, 900)
      const changedAt = new Date(baseDate.getTime() + (900 - daysAgo) * 86400000)
      changeLogs.push({
        site_id: site.id,
        field_name: field,
        old_value: field === 'annual_rent' ? String(randInt(15000, 60000)) : 'Previous value',
        new_value: field === 'annual_rent' ? String(randInt(20000, 95000)) : 'Updated value',
        changed_by: rand(changeUsers),
        changed_at: changedAt.toISOString(),
      })
    }

    // 1-4 documents per site
    const docTypes = ['lease', 'amendment', 'survey', 'permit', 'correspondence']
    const numDocs = randInt(1, 4)
    for (let i = 0; i < numDocs; i++) {
      const docType = rand(docTypes)
      docInserts.push({
        site_id: site.id,
        name: `${site.site_code}_${docType}_${2015 + randInt(0, 9)}.pdf`,
        doc_type: docType,
        uploaded_by: rand(changeUsers),
        uploaded_at: new Date(2018 + randInt(0, 6), randInt(0, 11), randInt(1, 28)).toISOString(),
        file_size_kb: randInt(80, 4200),
      })
    }
  }

  const { error: clError } = await supabase.from('site_change_log').insert(changeLogs)
  if (clError) console.error('Change log error:', clError)
  else console.log(`Inserted ${changeLogs.length} change log entries`)

  const { error: docError } = await supabase.from('site_documents').insert(docInserts)
  if (docError) console.error('Document error:', docError)
  else console.log(`Inserted ${docInserts.length} documents`)

  console.log('Seed complete.')
}

seed()
