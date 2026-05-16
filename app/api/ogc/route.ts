import { NextResponse } from 'next/server'

const BASE_URL = process.env.SITE_URL || 'https://tower-demo-461686768358.us-east1.run.app'
const OGC_BASE = `${BASE_URL}/api/ogc`

export async function GET() {
  return NextResponse.json({
    title: 'SCETV Tower Site Management — OGC API',
    description: 'OGC API – Features compliant endpoint for South Carolina ETV cell tower infrastructure.',
    links: [
      { href: OGC_BASE,                                    rel: 'self',           type: 'application/json',     title: 'This document' },
      { href: `${OGC_BASE}/conformance`,                   rel: 'conformance',    type: 'application/json',     title: 'Conformance classes' },
      { href: `${OGC_BASE}/collections`,                   rel: 'data',           type: 'application/json',     title: 'Feature collections' },
      { href: `${OGC_BASE}/collections/sites/items`,       rel: 'items',          type: 'application/geo+json', title: 'Tower sites (GeoJSON)' },
    ],
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
