import { NextResponse } from 'next/server'

const BASE_URL = process.env.SITE_URL || 'https://tower-demo-461686768358.us-east1.run.app'
const OGC_BASE = `${BASE_URL}/api/ogc`

export async function GET() {
  return NextResponse.json({
    collections: [
      {
        id: 'sites',
        title: 'Tower Sites',
        description: 'Cell tower and wireless infrastructure sites managed by South Carolina ETV.',
        extent: {
          spatial: {
            bbox: [[-83.35, 32.03, -78.50, 35.22]],  // South Carolina bounding box
            crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
          },
        },
        itemType: 'feature',
        crs: ['http://www.opengis.net/def/crs/OGC/1.3/CRS84'],
        links: [
          { href: `${OGC_BASE}/collections/sites`,        rel: 'self',  type: 'application/json',     title: 'This collection' },
          { href: `${OGC_BASE}/collections/sites/items`,  rel: 'items', type: 'application/geo+json', title: 'Tower site features' },
        ],
      },
    ],
    links: [
      { href: `${OGC_BASE}/collections`, rel: 'self', type: 'application/json', title: 'This document' },
    ],
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
