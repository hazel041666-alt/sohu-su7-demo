const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

module.exports = async function handler(req, res) {
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

  const colorLabel = (req.body && req.body.colorLabel ? String(req.body.colorLabel) : '海湾蓝').trim()
  const wheelLabel = (req.body && req.body.wheelLabel ? String(req.body.wheelLabel) : '19寸梅花轮毂').trim()

  const prompt = [
    '你是搜狐汽车互动广告文案助手。',
    '任务: 生成1句适合朋友圈分享的汽车文案，18-32字，科技感、积极正向、口语自然。',
    `用户选配: ${colorLabel} + ${wheelLabel}`,
    '硬约束: 不提及其他汽车品牌，不对比拉踩，不使用夸大承诺，不包含敏感话题。',
    '输出要求: 仅输出一句中文文案，不要解释。',
  ].join('\n')

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 120,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      res.status(502).json({ error: 'Doubao API failed', detail })
      return
    }

    const data = await response.json()
    const text =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      String(data.choices[0].message.content || '').trim()

    if (!text) {
      res.status(502).json({ error: 'No text from model' })
      return
    }

    res.status(200).json({ text })
  } catch (error) {
    res.status(502).json({
      error: 'API request error',
      detail: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
