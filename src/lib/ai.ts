import type { AdvisorResponse, UserDemand } from './types'

type AdvisorPayload = {
  query: string
  filters: UserDemand
}

export async function fetchAdvisorResult(payload: AdvisorPayload): Promise<AdvisorResponse> {
  const timeout = 30000
  const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
  // In production, always use same-origin API route to avoid cross-origin misconfiguration.
  const apiBase = import.meta.env.DEV ? configuredApiBase : ''
  const endpoint = apiBase ? `${apiBase}/api/experience-guide` : '/api/experience-guide'

  return await requestAdvisor(endpoint, payload, timeout)
}

async function requestAdvisor(endpoint: string, payload: AdvisorPayload, timeout: number): Promise<AdvisorResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      let detail = ''
      try {
        const errorBody = await response.json()
        detail = String(errorBody?.detail || errorBody?.error || '')
      } catch {
        detail = ''
      }
      throw new Error(detail || `API status ${response.status}`)
    }

    const data = (await response.json()) as AdvisorResponse
    if (!Array.isArray(data.recommendations)) {
      throw new Error('Invalid advisor response')
    }

    return data
  } finally {
    clearTimeout(timer)
  }
}
