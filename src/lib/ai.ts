import type { ChatMessage, GuideResult, ViewMode } from './types'

type Payload = {
  colorLabel: string
  wheelLabel: string
  userMessage: string
  history: ChatMessage[]
}

export async function askExperienceGuide(payload: Payload): Promise<GuideResult> {
  const timeout = 3000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch('/api/experience-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!response.ok) {
      throw new Error(`API status ${response.status}`)
    }

    const data = (await response.json()) as {
      reply?: string
      viewMode?: ViewMode
      highlights?: string[]
    }

    if (!data.reply) {
      throw new Error('No assistant reply')
    }

    return {
      reply: data.reply,
      viewMode: data.viewMode ?? inferViewMode(payload.userMessage),
      source: 'doubao',
      highlights: data.highlights ?? defaultHighlights(payload.colorLabel, payload.wheelLabel),
    }
  } catch {
    clearTimeout(timer)
    const viewMode = inferViewMode(payload.userMessage)
    return {
      reply: fallbackReply(payload.colorLabel, payload.wheelLabel, viewMode),
      viewMode,
      source: 'fallback',
      highlights: defaultHighlights(payload.colorLabel, payload.wheelLabel),
    }
  }
}

function defaultHighlights(colorLabel: string, wheelLabel: string) {
  return [
    `当前外观组合: ${colorLabel} + ${wheelLabel}`,
    '可继续问我: 续航、内饰屏幕、智驾辅助、车机体验',
    '满意后可直接点击预约线下试驾',
  ]
}

function inferViewMode(message: string): ViewMode {
  if (/(内饰|中控|屏幕|座舱|方向盘)/.test(message)) return 'interior'
  if (/(车头|前脸|大灯)/.test(message)) return 'front'
  if (/(尾灯|车尾|后备箱)/.test(message)) return 'rear'
  return 'exterior'
}

function fallbackReply(colorLabel: string, wheelLabel: string, viewMode: ViewMode) {
  const viewHint: Record<ViewMode, string> = {
    exterior: '我先带你看整车姿态和空气动力线条。',
    front: '我已切到车头视角，你可以关注灯组与前脸比例。',
    rear: '我已切到车尾视角，可以重点观察尾部层次与肩线收束。',
    interior: '我已切到内饰视角，重点看中控大屏与驾驶位交互。',
  }

  return `${viewHint[viewMode]} 当前配置为${colorLabel}搭配${wheelLabel}，这套更偏科技运动。想继续，我可以给你按通勤、家庭或性能场景做推荐。`
}
