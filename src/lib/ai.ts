import type { AdvisorResponse, UserDemand } from './types'

type AdvisorPayload = {
  query: string
  filters: UserDemand
}

const LOCAL_FALLBACK: AdvisorResponse = {
  parsed: {
    mode: 'form_fallback',
    demand: {},
    message: '后端接口暂不可用，已回退为前端最小演示结果。',
  },
  recommendations: [],
  comparison: [],
  sourceDisclaimer: '数据来源于搜狐汽车，价格与配置以官方最新信息为准。',
  fetchedAt: new Date().toISOString(),
  sourceStats: {
    totalModels: 0,
    liveScraped: 0,
    seeded: 0,
  },
}

export async function fetchAdvisorResult(payload: AdvisorPayload): Promise<AdvisorResponse> {
  const timeout = 30000
  const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
  // In production, always use same-origin API route to avoid cross-origin misconfiguration.
  const apiBase = import.meta.env.DEV ? configuredApiBase : ''
  const endpoint = apiBase ? `${apiBase}/api/experience-guide` : '/api/experience-guide'

  try {
    return await requestAdvisor(endpoint, payload, timeout)
  } catch (error) {
    console.error('Advisor API first attempt failed, retrying once:', error)
    try {
      return await requestAdvisor(endpoint, payload, timeout)
    } catch (retryError) {
      console.error('Advisor API retry failed:', retryError)
      const reason = retryError instanceof Error ? retryError.message : 'unknown_error'
      return {
        ...LOCAL_FALLBACK,
        parsed: {
          ...LOCAL_FALLBACK.parsed,
          message: `后端接口暂不可用（${reason}），已回退为前端最小演示结果。`,
        },
        fetchedAt: new Date().toISOString(),
      }
    }
  }
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
      throw new Error(`API status ${response.status}`)
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
