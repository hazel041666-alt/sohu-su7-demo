const DEFAULT_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
const CACHE_TTL_MS = 10 * 60 * 1000
const SCRAPE_FETCH_TIMEOUT_MS = 18000
const SOHU_SOURCE_URLS = [
  'https://db.auto.sohu.com/home/?pcm=202.412_16_0.0.0&scm=thor.412_14-201000.0.0-0-0-0-0.0',
  'https://db.auto.sohu.com/home/',
]

let cachedModels = []
let cacheExpiresAt = 0
let lastScrapeError = ''

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const query = String(req.body?.query || '').trim()
  const filters = sanitizeFilters(req.body?.filters)

  try {
    const marketModels = await getMarketModels()
    if (!marketModels.length) {
      throw new Error('搜狐汽车数据抓取为空，请稍后重试')
    }

    const parsed = await parseDemand(query, filters)
    const recommendations = recommendCars(marketModels, parsed.demand).slice(0, 3)
    const comparison = recommendations.map((item) => item.car)

    res.status(200).json({
      parsed,
      recommendations,
      comparison,
      sourceDisclaimer: '推荐数据来自搜狐汽车车库实时页面，点击来源可跳转到搜狐对应车型页。',
      fetchedAt: new Date().toISOString(),
      sourceStats: {
        totalModels: marketModels.length,
        liveScraped: marketModels.length,
        seeded: 0,
      },
    })
  } catch (error) {
    res.status(502).json({
      error: 'advisor request failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

function sanitizeFilters(filters) {
  if (!filters || typeof filters !== 'object') return {}

  const parseNumber = (value) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }

  return {
    budgetMinWan: parseNumber(filters.budgetMinWan),
    budgetMaxWan: parseNumber(filters.budgetMaxWan),
    scene: ['通勤', '家用', '长途'].includes(filters.scene) ? filters.scene : undefined,
    powerPreference: ['燃油', '纯电', '插混', '增程', '柴油', '其他'].includes(filters.powerPreference)
      ? filters.powerPreference
      : undefined,
    brandInclude: toBrandList(filters.brandInclude),
    brandExclude: toBrandList(filters.brandExclude),
    seats: filters.seats === 7 ? 7 : filters.seats === 5 ? 5 : undefined,
    smartNeed: typeof filters.smartNeed === 'string' ? filters.smartNeed.trim().slice(0, 120) : undefined,
  }
}

function toBrandList(raw) {
  if (!raw) return undefined
  if (Array.isArray(raw)) {
    const list = raw.map((x) => String(x).trim()).filter(Boolean)
    return list.length ? list : undefined
  }
  const split = String(raw)
    .split(/[，,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  return split.length ? split : undefined
}

async function parseDemand(query, filters) {
  const ruleDemand = parseDemandByRules(query)
  const fallbackDemand = mergeDemand(ruleDemand, filters)

  if (!query) {
    return {
      mode: 'form_fallback',
      demand: fallbackDemand,
      message: '未提供自然语言描述，已使用筛选条件推荐。',
    }
  }

  const apiKey = process.env.LLM_API_KEY || process.env.DOUBAO_API_KEY
  const model = process.env.LLM_MODEL || process.env.DOUBAO_MODEL || 'doubao-seed-1-6-250615'
  const apiUrl = process.env.LLM_API_URL || process.env.DOUBAO_API_URL || DEFAULT_API_URL

  if (!apiKey) {
    return {
      mode: 'form_fallback',
      demand: fallbackDemand,
      message: '未配置 LLM key，已回退规则解析。',
    }
  }

  const prompt = [
    '你是汽车选购需求解析器。',
    '请从用户中文文本中提取JSON，字段为：budgetMinWan,budgetMaxWan,scene,powerPreference,brandInclude,brandExclude,seats,smartNeed。',
    'scene只能是: 通勤|家用|长途。',
    'powerPreference只能是: 燃油|纯电|插混|增程|柴油|其他。',
    'seats只能是5或7。',
    'brandInclude和brandExclude是字符串数组。',
    '无法确定的字段不要填。',
    '仅输出JSON对象，不要输出其他内容。',
    `用户输入: ${query}`,
  ].join('\n')

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是严格JSON输出助手。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 240,
      }),
    })

    if (!response.ok) {
      return {
        mode: 'form_fallback',
        demand: fallbackDemand,
        message: 'AI解析失败，已回退表单与规则解析。',
      }
    }

    const data = await response.json()
    const raw = String(data?.choices?.[0]?.message?.content || '').trim()
    const parsed = parseJsonObject(raw)

    if (!parsed) {
      return {
        mode: 'form_fallback',
        demand: fallbackDemand,
        message: 'AI解析结果不可用，已回退表单与规则解析。',
      }
    }

    const aiDemand = sanitizeFilters(parsed)
    // Merge order: rule < AI < explicit form filters.
    // This keeps rule-extracted constraints (e.g., budget) when AI misses fields.
    const mergedDemand = mergeDemand(mergeDemand(ruleDemand, aiDemand), filters)

    return {
      mode: 'ai',
      demand: mergedDemand,
      message: '已使用自然语言解析，并对缺失字段使用规则兜底后与筛选条件合并。',
    }
  } catch {
    return {
      mode: 'form_fallback',
      demand: fallbackDemand,
      message: 'AI解析超时或异常，已回退表单与规则解析。',
    }
  }
}

function parseJsonObject(raw) {
  try {
    const from = raw.indexOf('{')
    const to = raw.lastIndexOf('}')
    const text = from >= 0 && to > from ? raw.slice(from, to + 1) : raw
    return JSON.parse(text)
  } catch {
    return null
  }
}

function parseDemandByRules(query) {
  const text = String(query || '')

  const budgetMatch = text.match(/(\d{1,3}(?:\.\d+)?)\s*[-到至]\s*(\d{1,3}(?:\.\d+)?)\s*万/)
  const underMatch = text.match(/(\d{1,3}(?:\.\d+)?)\s*万\s*(以内|以下)/)
  const overMatch = text.match(/(\d{1,3}(?:\.\d+)?)\s*万\s*(以上|起)/)

  const demand = {}

  if (budgetMatch) {
    demand.budgetMinWan = Number(budgetMatch[1])
    demand.budgetMaxWan = Number(budgetMatch[2])
  } else if (underMatch) {
    demand.budgetMaxWan = Number(underMatch[1])
  } else if (overMatch) {
    demand.budgetMinWan = Number(overMatch[1])
  }

  if (/通勤|上班|代步/.test(text)) demand.scene = '通勤'
  if (/家用|带娃|家庭/.test(text)) demand.scene = '家用'
  if (/长途|自驾|高速/.test(text)) demand.scene = '长途'

  if (/纯电|电车|EV/i.test(text)) demand.powerPreference = '纯电'
  if (/插混|PHEV/i.test(text)) demand.powerPreference = '插混'
  if (/增程/i.test(text)) demand.powerPreference = '增程'
  if (/燃油/.test(text)) demand.powerPreference = '燃油'
  if (/柴油/.test(text)) demand.powerPreference = '柴油'

  if (/7座|七座|七人座/.test(text)) demand.seats = 7
  if (/5座|五座|五人座/.test(text)) demand.seats = 5

  return demand
}

function mergeDemand(base, override) {
  const merged = { ...(base || {}) }

  for (const [key, value] of Object.entries(override || {})) {
    if (value !== undefined) {
      merged[key] = value
    }
  }

  return merged
}

async function getMarketModels() {
  const now = Date.now()
  if (now < cacheExpiresAt && cachedModels.length) {
    return cachedModels
  }

  const models = await scrapeSohuModels()
  if (!models.length) {
    if (cachedModels.length) {
      return cachedModels
    }
    throw new Error(`搜狐页面暂无可用车型数据（${lastScrapeError || '抓取失败'}）`)
  }

  cachedModels = models
  cacheExpiresAt = now + CACHE_TTL_MS
  return models
}

async function scrapeSohuModels() {
  const errors = []

  for (const url of SOHU_SOURCE_URLS) {
    try {
      const html = await fetchPageWithRetry(url)
      if (!html) {
        errors.push(`empty_html@${url}`)
        continue
      }

      const table = extractNuxtDataTable(html)
      if (!table) {
        errors.push(`no_nuxt_payload@${url}`)
        continue
      }

      const decoded = decodeNuxtIndexedTable(table)
      const groups = decoded?.data?.fetchRecoAndPickCar?.pickCarModelData?.value
      if (!Array.isArray(groups)) {
        errors.push(`no_model_groups@${url}`)
        continue
      }

      const rows = []
      for (const group of groups) {
        const models = Array.isArray(group?.models) ? group.models : []
        for (const model of models) {
          rows.push(model)
        }
      }

      const normalized = normalizeExtracted(rows)
      if (normalized.length) {
        lastScrapeError = ''
        return normalized
      }

      errors.push(`normalized_empty@${url}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_scrape_error'
      errors.push(`${message}@${url}`)
    }
  }

  lastScrapeError = errors.slice(0, 2).join(' | ')
  return []
}

async function fetchPageWithRetry(url) {
  let lastError = null

  for (const timeout of [12000, SCRAPE_FETCH_TIMEOUT_MS]) {
    try {
      return await fetchPage(url, timeout)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('fetch_failed')
}

async function fetchPage(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
    })
    clearTimeout(timer)
    if (!response.ok) throw new Error(`source_status_${response.status}`)
    return await response.text()
  } catch (error) {
    clearTimeout(timer)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`source_timeout_${timeoutMs}ms`)
    }
    throw error
  }
}

function extractNuxtDataTable(html) {
  const match = String(html).match(/<script[^>]+id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!match) return null

  try {
    const table = JSON.parse(match[1])
    return Array.isArray(table) ? table : null
  } catch {
    return null
  }
}

function decodeNuxtIndexedTable(table) {
  const cache = new Map()
  const resolving = new Set()

  const resolveToken = (token) => {
    if (typeof token === 'number' && Number.isInteger(token) && token >= 0 && token < table.length) {
      return resolveRef(token)
    }
    return token
  }

  const resolveStored = (entry) => {
    if (Array.isArray(entry)) {
      if (entry.length === 2 && typeof entry[0] === 'string' && ['ShallowReactive', 'Reactive', 'Ref'].includes(entry[0])) {
        return resolveToken(entry[1])
      }
      return entry.map((item) => resolveToken(item))
    }

    if (entry && typeof entry === 'object') {
      const out = {}
      for (const [k, v] of Object.entries(entry)) {
        out[k] = resolveToken(v)
      }
      return out
    }

    return entry
  }

  const resolveRef = (index) => {
    if (cache.has(index)) return cache.get(index)
    if (resolving.has(index)) return null

    resolving.add(index)
    const resolved = resolveStored(table[index])
    resolving.delete(index)
    cache.set(index, resolved)
    return resolved
  }

  return resolveRef(0)
}

function normalizeExtracted(rows) {
  const uniq = new Map()

  for (const row of rows) {
    const modelId = Number(row?.model_id)
    const model = String(row?.name || '').trim()
    const brand = String(row?.brand_name || '').trim()
    const minPrice = toNumber(row?.min_price)
    const maxPrice = toNumber(row?.max_price)

    if (!modelId || !model || !brand || !Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
      continue
    }

    const key = modelKey(brand, model)
    if (uniq.has(key)) continue

    const powerType = guessPowerType(model)
    uniq.set(key, {
      id: `sohu-model-${modelId}`,
      brand,
      model,
      category: '其他',
      seats: undefined,
      powerType,
      priceMinWan: minPrice,
      priceMaxWan: maxPrice,
      level: '以搜狐页面为准',
      sizeMm: '-',
      wheelbaseMm: 0,
      rangeOrFuel: '-',
      adas: '-',
      cockpit: '-',
      sourceUrl: `https://db.auto.sohu.com/model_${modelId}`,
      officialUrl: '',
    })
  }

  return [...uniq.values()]
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

function guessPowerType(modelName) {
  const text = String(modelName || '').toLowerCase()

  if (/dm-i|dmi|phev|插混|混动/.test(text)) return '插混'
  if (/增程|erev/.test(text)) return '增程'
  if (/ev|纯电|电动|新能源/.test(text)) return '纯电'
  if (/tdi|柴油/.test(text)) return '柴油'
  return '燃油'
}

function modelKey(brand, model) {
  return `${String(brand)}-${String(model)}`
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
}

function recommendCars(cars, demand) {
  const filtered = cars.filter((car) => {
    if (typeof demand.budgetMinWan === 'number' && car.priceMaxWan < demand.budgetMinWan) return false
    if (typeof demand.budgetMaxWan === 'number' && car.priceMinWan > demand.budgetMaxWan) return false
    if (demand.powerPreference && car.powerType !== demand.powerPreference) return false

    if (Array.isArray(demand.brandInclude) && demand.brandInclude.length) {
      const matched = demand.brandInclude.some((name) => car.brand.includes(name))
      if (!matched) return false
    }
    if (Array.isArray(demand.brandExclude) && demand.brandExclude.length) {
      const blocked = demand.brandExclude.some((name) => car.brand.includes(name))
      if (blocked) return false
    }
    return true
  })

  return filtered
    .map((car) => {
      const score = calcScore(car, demand)
      return {
        car,
        score,
        reason: buildReason(car, demand),
      }
    })
    .sort((a, b) => b.score - a.score)
}

function calcScore(car, demand) {
  let score = 50

  if (typeof demand.budgetMinWan === 'number' && typeof demand.budgetMaxWan === 'number') {
    const mid = (demand.budgetMinWan + demand.budgetMaxWan) / 2
    const carMid = (car.priceMinWan + car.priceMaxWan) / 2
    score += Math.max(0, 25 - Math.abs(carMid - mid) * 1.8)
  }

  if (demand.powerPreference && car.powerType === demand.powerPreference) {
    score += 18
  }

  if (demand.scene === '通勤') {
    if (car.category === '轿车' || car.category === 'SUV' || car.category === '其他') score += 10
  }

  if (demand.scene === '家用') {
    if (car.category === 'SUV' || car.category === 'MPV' || car.category === '其他') score += 12
  }

  if (demand.scene === '长途') {
    if (car.powerType === '燃油' || car.powerType === '增程' || car.powerType === '插混') score += 13
  }

  return Math.round(score)
}

function buildReason(car, demand) {
  const parts = []

  if (demand.scene) parts.push(`适配${demand.scene}场景`)
  if (demand.powerPreference) parts.push(`动力偏好匹配${demand.powerPreference}`)

  if (typeof demand.budgetMinWan === 'number' || typeof demand.budgetMaxWan === 'number') {
    parts.push(`价格区间约${car.priceMinWan}-${car.priceMaxWan}万`)
  }

  parts.push('来源为搜狐车库实时车型页')
  return parts.join('；')
}
