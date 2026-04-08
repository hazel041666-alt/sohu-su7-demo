const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const apiKey = process.env.DOUBAO_API_KEY
  const model = process.env.DOUBAO_MODEL || 'doubao-seed-1-6-250615'

  if (!apiKey) {
    res.status(500).json({ error: 'Missing DOUBAO_API_KEY' })
    return
  }

  const colorLabel = (req.body?.colorLabel ? String(req.body.colorLabel) : '海湾蓝').trim()
  const wheelLabel = (req.body?.wheelLabel ? String(req.body.wheelLabel) : '19寸梅花轮毂').trim()
  const userMessage = (req.body?.userMessage ? String(req.body.userMessage) : '').trim()
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : []

  if (!userMessage) {
    res.status(400).json({ error: 'Missing userMessage' })
    return
  }

  const historyLines = history
    .map((item) => `${item.role === 'assistant' ? '体验官' : '用户'}: ${String(item.text || '').slice(0, 140)}`)
    .join('\n')

  const systemPrompt = [
    '你是“AI产品体验官”，负责在3D汽车网页里通过对话引导用户了解车辆并促成预约试驾。',
    `当前车辆配置: ${colorLabel} + ${wheelLabel}`,
    '回复要求: 1-2句中文，专业但口语化，必须积极正向。',
    '禁止: 提及其他汽车品牌、对比拉踩、夸张承诺。',
    '请输出严格JSON，不要输出其他内容。',
    'JSON schema: {"reply":"string","viewMode":"exterior|front|rear|interior","highlights":["string","string","string"]}',
  ].join('\n')

  const userPrompt = [
    historyLines ? `最近对话:\n${historyLines}` : '',
    `用户最新问题: ${userMessage}`,
    '请给出下一步推荐并决定切换视角。',
  ].filter(Boolean).join('\n\n')

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 280,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      res.status(502).json({ error: 'Doubao API failed', detail })
      return
    }

    const data = await response.json()
    const raw = String(data?.choices?.[0]?.message?.content || '').trim()
    const parsed = parseGuideJson(raw)

    if (!parsed) {
      res.status(502).json({ error: 'Failed to parse model JSON', raw })
      return
    }

    res.status(200).json(parsed)
  } catch (error) {
    res.status(502).json({
      error: 'API request error',
      detail: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

function parseGuideJson(raw) {
  try {
    const normalized = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    const parsed = JSON.parse(normalized)
    const viewMode = ['exterior', 'front', 'rear', 'interior'].includes(parsed.viewMode)
      ? parsed.viewMode
      : 'exterior'
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.map((x) => String(x)).slice(0, 3)
      : []

    if (!parsed.reply) return null

    return {
      reply: String(parsed.reply),
      viewMode,
      highlights,
    }
  } catch {
    return null
  }
}
