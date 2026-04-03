import { buildFallbackCopy } from './fallbackCopy'
import type { CopyResult } from './types'

type Payload = {
  colorLabel: string
  wheelLabel: string
}

export async function generateAdCopy(payload: Payload): Promise<CopyResult> {
  const edition = `极速${payload.colorLabel} x ${payload.wheelLabel}`
  const timeout = 3000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch('/api/generate-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!response.ok) {
      throw new Error(`API status ${response.status}`)
    }

    const data = (await response.json()) as { text?: string }
    if (!data.text) {
      throw new Error('No copy text')
    }

    return { text: data.text, source: 'doubao' }
  } catch {
    clearTimeout(timer)
    return {
      text: buildFallbackCopy(edition),
      source: 'fallback',
    }
  }
}
