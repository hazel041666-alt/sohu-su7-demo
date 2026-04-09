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
  recommendations: [
    {
      car: {
        id: 'fallback-toyota-sienna',
        brand: '丰田',
        model: '赛那',
        category: 'MPV',
        seats: 7,
        powerType: '燃油',
        priceMinWan: 29.98,
        priceMaxWan: 41.18,
        level: '中大型MPV',
        sizeMm: '5165x1995x1765',
        wheelbaseMm: 3060,
        rangeOrFuel: 'WLTC 5.9-6.6L/100km',
        adas: 'TSS辅助驾驶系统',
        cockpit: '语音交互+多屏互联',
        sourceUrl: 'https://search.sohu.com/search?keyword=%E4%B8%B0%E7%94%B0%20%E8%B5%9B%E9%82%A3%20%E5%8F%82%E6%95%B0%20%E6%8A%A5%E4%BB%B7',
        officialUrl: 'https://www.gac-toyota.com.cn',
      },
      score: 70,
      reason: '接口异常时的本地兜底推荐：空间表现和家用场景适配度高。',
    },
    {
      car: {
        id: 'fallback-tesla-model3',
        brand: '特斯拉',
        model: 'Model 3',
        category: '轿车',
        seats: 5,
        powerType: '纯电',
        priceMinWan: 23.19,
        priceMaxWan: 33.59,
        level: '中型车',
        sizeMm: '4720x1848x1442',
        wheelbaseMm: 2875,
        rangeOrFuel: 'CLTC 606-713km',
        adas: '基础辅助驾驶，支持NOA能力扩展',
        cockpit: '15.4英寸中控，语音与多媒体生态',
        sourceUrl: 'https://search.sohu.com/search?keyword=%E7%89%B9%E6%96%AF%E6%8B%89%20Model%203%20%E5%8F%82%E6%95%B0%20%E6%8A%A5%E4%BB%B7',
        officialUrl: 'https://www.tesla.cn/model3',
      },
      score: 67,
      reason: '接口异常时的本地兜底推荐：通勤效率和电驱体验均衡。',
    },
    {
      car: {
        id: 'fallback-li-l6',
        brand: '理想',
        model: 'L6',
        category: 'SUV',
        seats: 5,
        powerType: '增程',
        priceMinWan: 24.98,
        priceMaxWan: 27.98,
        level: '中大型SUV',
        sizeMm: '4925x1960x1735',
        wheelbaseMm: 2920,
        rangeOrFuel: 'CLTC综合续航1300km+',
        adas: '高速NOA，城区辅助驾驶',
        cockpit: '双联屏+语音大模型+后排娱乐',
        sourceUrl: 'https://search.sohu.com/search?keyword=%E7%90%86%E6%83%B3%20L6%20%E5%8F%82%E6%95%B0%20%E6%8A%A5%E4%BB%B7',
        officialUrl: 'https://www.lixiang.com',
      },
      score: 66,
      reason: '接口异常时的本地兜底推荐：综合续航与家庭舒适性表现稳健。',
    },
  ],
  comparison: [],
  sourceDisclaimer: '数据来源于搜狐汽车，价格与配置以官方最新信息为准。',
  fetchedAt: new Date().toISOString(),
  sourceStats: {
    totalModels: 3,
    liveScraped: 0,
    seeded: 3,
  },
}

LOCAL_FALLBACK.comparison = LOCAL_FALLBACK.recommendations.map((item) => item.car)

export function getInstantFallbackResult(message?: string): AdvisorResponse {
  return {
    ...LOCAL_FALLBACK,
    parsed: {
      ...LOCAL_FALLBACK.parsed,
      message: message || LOCAL_FALLBACK.parsed.message,
    },
    fetchedAt: new Date().toISOString(),
  }
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
        ...getInstantFallbackResult(`后端接口暂不可用（${reason}），已回退为前端最小演示结果。`),
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
