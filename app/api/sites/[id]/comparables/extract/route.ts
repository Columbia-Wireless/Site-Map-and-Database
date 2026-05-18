import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

const KEY_FIELDS = ['site_name', 'city', 'state', 'tower_type', 'annual_rent']
const ALL_FIELDS = [...KEY_FIELDS, 'height_ft', 'active_tenants', 'tenant_slots', 'distance_miles']

function calcCompleteness(confidence: Record<string, string>, values: Record<string, any>): number {
  let score = 0
  for (const f of KEY_FIELDS) {
    const v = values[f]
    const c = confidence[f]
    if (v != null && v !== '') {
      score += c === 'high' ? 20 : c === 'medium' ? 12 : 6
    }
  }
  return Math.min(100, score)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params // validate route param exists

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const prompt = `Extract tower/antenna site comparable information from this document.
Return ONLY a JSON object with exactly these fields. For each field include "value" and "confidence" (high/medium/low).
Use null for value if not found.

{
  "site_name":       { "value": "string or null",  "confidence": "high|medium|low" },
  "city":            { "value": "string or null",  "confidence": "high|medium|low" },
  "state":           { "value": "2-letter code or null", "confidence": "high|medium|low" },
  "tower_type":      { "value": "monopole|lattice|rooftop|water_tower|guyed|small_cell|null", "confidence": "high|medium|low" },
  "height_ft":       { "value": number or null,    "confidence": "high|medium|low" },
  "annual_rent":     { "value": number or null,    "confidence": "high|medium|low" },
  "active_tenants":  { "value": number or null,    "confidence": "high|medium|low" },
  "tenant_slots":    { "value": number or null,    "confidence": "high|medium|low" },
  "distance_miles":  { "value": number or null,    "confidence": "low" }
}

For annual_rent: if monthly rent is given, multiply by 12. Return numbers without currency symbols.
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
    // Strip any markdown fences if present
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const extracted = JSON.parse(jsonStr)

    // Build flat values and confidence maps
    const values: Record<string, any> = {}
    const confidence: Record<string, string> = {}
    for (const field of ALL_FIELDS) {
      values[field]     = extracted[field]?.value ?? null
      confidence[field] = extracted[field]?.confidence ?? 'low'
    }

    const completeness_pct = calcCompleteness(confidence, values)

    return NextResponse.json({ values, confidence, completeness_pct, filename: file.name })
  } catch (err: any) {
    console.error('[extract] Claude API error:', err?.message)
    return NextResponse.json({ error: 'Extraction failed: ' + (err?.message ?? 'unknown') }, { status: 500 })
  }
}
