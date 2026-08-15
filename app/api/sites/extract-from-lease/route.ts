import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getProfile } from '@/lib/profile'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

const ALL_FIELDS = [
  'site_name', 'address', 'city', 'state', 'zip', 'lat', 'lng',
  'tower_type', 'height_ft', 'lease_start_date', 'lease_term_years', 'base_rent_annual',
]

export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const prompt = `Extract tower/antenna site information from this lease document.
Return ONLY a JSON object with exactly these fields. For each field include "value" and "confidence" (high/medium/low).
Use null for value if not found.

{
  "site_name":         { "value": "string or null",  "confidence": "high|medium|low" },
  "address":           { "value": "street address or null", "confidence": "high|medium|low" },
  "city":              { "value": "string or null",  "confidence": "high|medium|low" },
  "state":             { "value": "2-letter code or null", "confidence": "high|medium|low" },
  "zip":               { "value": "string or null",  "confidence": "high|medium|low" },
  "lat":               { "value": number or null,    "confidence": "high|medium|low" },
  "lng":               { "value": number or null,    "confidence": "high|medium|low" },
  "tower_type":        { "value": "monopole|lattice|rooftop|water_tower|guyed|small_cell|null", "confidence": "high|medium|low" },
  "height_ft":         { "value": number or null,    "confidence": "high|medium|low" },
  "lease_start_date":  { "value": "YYYY-MM-DD or null", "confidence": "high|medium|low" },
  "lease_term_years":  { "value": number or null,    "confidence": "high|medium|low" },
  "base_rent_annual":  { "value": number or null,    "confidence": "high|medium|low" }
}

Only include lat/lng if explicit coordinates appear in the document (do not estimate from address).
For base_rent_annual: if monthly rent is given, multiply by 12. Return numbers without currency symbols.
Return only the JSON object, no markdown, no explanation.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          } as any,
          { type: 'text', text: prompt },
        ],
      }],
    })

    const raw = (message.content[0] as any).text?.trim() ?? ''
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const extracted = JSON.parse(jsonStr)

    const values: Record<string, any> = {}
    const confidence: Record<string, string> = {}
    for (const field of ALL_FIELDS) {
      values[field] = extracted[field]?.value ?? null
      confidence[field] = extracted[field]?.confidence ?? 'low'
    }

    return NextResponse.json({ values, confidence, filename: file.name })
  } catch (err: any) {
    console.error('[extract-from-lease] Claude API error:', err?.message)
    return NextResponse.json({ error: 'Extraction failed: ' + (err?.message ?? 'unknown') }, { status: 500 })
  }
}
