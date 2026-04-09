import * as cheerio from 'cheerio'

const DEFAULT_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
const CACHE_TTL_MS = 15 * 60 * 1000
const SCRAPE_FETCH_TIMEOUT_MS = 3500

const SOURCE_URLS = [
  'https://auto.sohu.com/',
  'https://db.auto.sohu.com/',
]

let cachedModels = []
let cacheExpiresAt = 0

const seededModels = [
  {
    id: 'byd-qin-l-ev',
    brand: '比亚迪',
    model: '秦L EV',
    category: '轿车',
    seats: 5,
    powerType: '纯电',
    priceMinWan: 11.98,
    priceMaxWan: 16.98,
    level: '中型车',
    sizeMm: '4830x1900x1495',
    wheelbaseMm: 2790,
    rangeOrFuel: 'CLTC 510-610km',
    adas: 'L2级辅助驾驶，AEB/ACC/LKA',
    cockpit: 'DiLink 语音+导航+生态应用',
    sourceUrl: buildSohuModelSearchUrl('比亚迪', '秦L EV'),
    officialUrl: 'https://www.byd.com/cn/car/qinl-ev',
  },
  {
    id: 'tesla-model3',
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
    sourceUrl: buildSohuModelSearchUrl('特斯拉', 'Model 3'),
    officialUrl: 'https://www.tesla.cn/model3',
  },
  {
    id: 'geely-xingyue-l',
    brand: '吉利',
    model: '星越L',
    category: 'SUV',
    seats: 5,
    powerType: '燃油',
    priceMinWan: 13.72,
    priceMaxWan: 18.52,
    level: '紧凑型SUV',
    sizeMm: '4770x1895x1689',
    wheelbaseMm: 2845,
    rangeOrFuel: 'WLTC 7.5L/100km',
    adas: 'L2级辅助驾驶，360全景',
    cockpit: '多联屏+语音助手+手机互联',
    sourceUrl: buildSohuModelSearchUrl('吉利', '星越L'),
    officialUrl: 'https://www.geely.com',
  },
  {
    id: 'li-auto-l6',
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
    sourceUrl: buildSohuModelSearchUrl('理想', 'L6'),
    officialUrl: 'https://www.lixiang.com',
  },
  {
    id: 'toyota-sienna',
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
    sourceUrl: buildSohuModelSearchUrl('丰田', '赛那'),
    officialUrl: 'https://www.gac-toyota.com.cn',
  },
  {
    id: 'ford-ranger',
    brand: '福特',
    model: 'Ranger',
    category: '皮卡',
    seats: 5,
    powerType: '柴油',
    priceMinWan: 14.58,
    priceMaxWan: 24.48,
    level: '中型皮卡',
    sizeMm: '5370x1918x1880',
    wheelbaseMm: 3270,
    rangeOrFuel: '综合油耗约8.4L/100km',
    adas: 'L2辅助驾驶，拖挂辅助',
    cockpit: '大屏导航+语音控制',
    sourceUrl: buildSohuModelSearchUrl('福特', 'Ranger'),
    officialUrl: 'https://www.ford.com.cn',
  },
]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const query = String(req.body?.query || '').trim()
  const filters = sanitizeFilters(req.body?.filters)

  try {
    const marketModels = await getMarketModels()
    const parsed = await parseDemand(query, filters)
    const recommendations = recommendCars(marketModels, parsed.demand).slice(0, 3)

    if (recommendations.length < 3) {
      const fill = recommendCars(marketModels, {}).slice(0, 3 - recommendations.length)
      for (const item of fill) {
        if (!recommendations.some((x) => x.car.id === item.car.id)) {
          recommendations.push(item)
        }
      }
    }

    const comparison = recommendations.map((item) => item.car)

    res.status(200).json({
      parsed,
      recommendations,
      comparison,
      sourceDisclaimer: '数据来源于搜狐汽车，价格与配置以官方最新信息为准。当搜狐与官网冲突时，已优先采用官网参数。',
      fetchedAt: new Date().toISOString(),
      sourceStats: {
        totalModels: marketModels.length,
        liveScraped: Math.max(marketModels.length - seededModels.length, 0),
        seeded: seededModels.length,
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
  const fallbackDemand = mergeDemand(parseDemandByRules(query), filters)

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

    return {
      mode: 'ai',
      demand: mergeDemand(sanitizeFilters(parsed), filters),
      message: '已使用自然语言解析并与筛选条件合并。',
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

  if (/纯电|电车|EV/.test(text)) demand.powerPreference = '纯电'
  if (/插混|PHEV/.test(text)) demand.powerPreference = '插混'
  if (/增程/.test(text)) demand.powerPreference = '增程'
  if (/燃油/.test(text)) demand.powerPreference = '燃油'
  if (/柴油/.test(text)) demand.powerPreference = '柴油'

  if (/7座/.test(text)) demand.seats = 7
  if (/5座/.test(text)) demand.seats = 5

  return demand
}

function mergeDemand(base, override) {
  return {
    ...base,
    ...override,
    brandInclude: override.brandInclude || base.brandInclude,
    brandExclude: override.brandExclude || base.brandExclude,
  }
}

async function getMarketModels() {
  const now = Date.now()
  if (now < cacheExpiresAt && cachedModels.length) {
    return cachedModels
  }

  const live = await scrapeSohuModels()
  const merged = mergeAndPreferOfficial(seededModels, live)
  cachedModels = merged
  cacheExpiresAt = now + CACHE_TTL_MS
  return merged
}

function mergeAndPreferOfficial(seed, live) {
  const map = new Map()

  for (const item of [...seed, ...live]) {
    const key = modelKey(item.brand, item.model)
    const old = map.get(key)
    if (!old) {
      map.set(key, item)
      continue
    }

    map.set(key, {
      ...old,
      ...item,
      officialUrl: item.officialUrl || old.officialUrl,
      sourceUrl: item.sourceUrl || old.sourceUrl || buildSohuModelSearchUrl(item.brand, item.model),
      level: item.level || old.level,
      sizeMm: item.sizeMm || old.sizeMm,
      wheelbaseMm: item.wheelbaseMm || old.wheelbaseMm,
      rangeOrFuel: item.rangeOrFuel || old.rangeOrFuel,
      adas: item.adas || old.adas,
      cockpit: item.cockpit || old.cockpit,
    })
  }

  return [...map.values()]
}

function modelKey(brand, model) {
  return `${String(brand)}-${String(model)}`
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
}

function buildSohuModelSearchUrl(brand, model) {
  const keyword = `${String(brand)} ${String(model)} 参数 报价`
  return `https://search.sohu.com/search?keyword=${encodeURIComponent(keyword)}`
}

async function scrapeSohuModels() {
  const requests = SOURCE_URLS.map((url) => fetchPage(url))
  const pages = await Promise.allSettled(requests)

  const models = []

  for (const result of pages) {
    if (result.status !== 'fulfilled' || !result.value) continue
    const extracted = extractCarsFromHtml(result.value)
    models.push(...extracted)
  }

  return normalizeExtracted(models)
}

async function fetchPage(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SCRAPE_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
    })
    clearTimeout(timer)
    if (!response.ok) return ''
    return await response.text()
  } catch {
    clearTimeout(timer)
    return ''
  }
}

function extractCarsFromHtml(html) {
  if (!html) return []

  const $ = cheerio.load(html)
  const rows = []

  $('a').each((_idx, node) => {
    const text = $(node).text().replace(/\s+/g, ' ').trim()
    const href = String($(node).attr('href') || '').trim()
    if (!text || !href) return

    const looksLikeModel = /[A-Za-z\u4e00-\u9fa5]+\s?[A-Za-z0-9\-]+/.test(text)
    const includesAuto = /auto\.sohu\.com|db\.auto\.sohu\.com/.test(href)
    if (!looksLikeModel || !includesAuto) return

    rows.push({ text, href })
  })

  return rows
}

function normalizeExtracted(rows) {
  const models = []
  let index = 0

  for (const item of rows) {
    const text = item.text
    const modelText = text.replace(/报价|参数|图片|论坛|口碑/g, '').trim()
    if (!modelText || modelText.length < 2 || modelText.length > 36) continue

    const parts = modelText.split(/\s+/)
    const brand = parts[0]
    const model = parts.slice(1).join(' ') || parts[0]
    if (!brand || !model) continue

    const lower = modelText.toLowerCase()
    const category = lower.includes('mpv')
      ? 'MPV'
      : lower.includes('suv')
        ? 'SUV'
        : /皮卡|pickup/.test(modelText)
          ? '皮卡'
          : '轿车'

    const powerType = /ev|纯电|电动/.test(lower)
      ? '纯电'
      : /增程/.test(modelText)
        ? '增程'
        : /插混|phev/.test(lower)
          ? '插混'
          : '燃油'

    index += 1
    models.push({
      id: `live-${index}-${brand}-${model}`.replace(/\s+/g, '-').toLowerCase(),
      brand,
      model,
      category,
      seats: /7座/.test(modelText) ? 7 : 5,
      powerType,
      priceMinWan: 10,
      priceMaxWan: 25,
      level: '待补充',
      sizeMm: '待补充',
      wheelbaseMm: 0,
      rangeOrFuel: powerType === '纯电' ? '续航待补充' : '油耗待补充',
      adas: '辅助驾驶信息待补充',
      cockpit: '车机能力待补充',
      sourceUrl: normalizeUrl(item.href),
      officialUrl: '',
    })
  }

  const uniq = new Map()
  for (const car of models) {
    const key = modelKey(car.brand, car.model)
    if (!uniq.has(key)) uniq.set(key, car)
  }

  return [...uniq.values()]
}

function normalizeUrl(url) {
  const value = String(url || '').trim()
  if (!value) return 'https://auto.sohu.com/'

  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`

  // Some pages return host-style href values like "db.auto.sohu.com/model_xxx/".
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(value)) {
    return `https://${value.replace(/^\/+/, '')}`
  }

  if (value.startsWith('/')) return `https://auto.sohu.com${value}`
  return `https://auto.sohu.com/${value.replace(/^\.\//, '')}`
}

function recommendCars(cars, demand) {
  const filtered = cars.filter((car) => {
    if (typeof demand.budgetMinWan === 'number' && car.priceMaxWan < demand.budgetMinWan) return false
    if (typeof demand.budgetMaxWan === 'number' && car.priceMinWan > demand.budgetMaxWan) return false
    if (demand.powerPreference && car.powerType !== demand.powerPreference) return false
    if (demand.seats && car.seats !== demand.seats) return false
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
    if (car.category === '轿车' || car.category === 'SUV') score += 12
    if (car.powerType === '纯电' || car.powerType === '插混') score += 8
  }

  if (demand.scene === '家用') {
    if (car.category === 'SUV' || car.category === 'MPV') score += 14
    if (car.seats === 7) score += 10
  }

  if (demand.scene === '长途') {
    if (car.powerType === '燃油' || car.powerType === '增程' || car.powerType === '插混') score += 13
    if (car.category === 'SUV' || car.category === 'MPV') score += 8
  }

  if (demand.smartNeed) {
    const key = String(demand.smartNeed)
    if (car.adas.includes(key) || car.cockpit.includes(key)) score += 10
  }

  return Math.round(score)
}

function buildReason(car, demand) {
  const parts = []

  if (demand.scene) parts.push(`适配${demand.scene}场景`)
  if (demand.powerPreference) parts.push(`动力类型匹配${demand.powerPreference}`)

  if (typeof demand.budgetMinWan === 'number' || typeof demand.budgetMaxWan === 'number') {
    parts.push(`价格区间约${car.priceMinWan}-${car.priceMaxWan}万`) 
  }

  parts.push(`提供${car.adas}，并支持${car.cockpit}`)
  return parts.join('；')
}
