import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import CarShowroomCanvas from '../components/CarShowroomCanvas'
import { askExperienceGuide } from '../lib/ai'
import {
  markBookingClick,
  markGuideConversation,
  markInteraction,
  registerPageVisit,
} from '../lib/analytics'
import { paintColors, wheelStyles } from '../lib/catalog'
import type { ChatMessage, ViewMode } from '../lib/types'

const CTA_URL =
  '/mock-reservation?utm_source=sohu_ai_demo&utm_medium=guide_cta&utm_campaign=su7_launch'

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => Recognition
    SpeechRecognition?: new () => Recognition
  }
}

export default function DemoPage() {
  const [selectedColor, setSelectedColor] = useState(paintColors[0])
  const [selectedWheel, setSelectedWheel] = useState(wheelStyles[0])
  const [loadingModel, setLoadingModel] = useState(true)
  const [visitorId, setVisitorId] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('exterior')

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      source: 'fallback',
      text: '你好，我是AI产品体验官。你可以问我“看下内饰大屏”或“推荐通勤配置”，我会带你切换视角并给建议。',
    },
  ])
  const [highlights, setHighlights] = useState<string[]>([
    '可语音提问: 看内饰、看车头、聊续航、聊智驾',
    '体验官会自动切换展厅视角并讲解亮点',
    '满意后可直接点击预约线下试驾',
  ])
  const [inputText, setInputText] = useState('')
  const [asking, setAsking] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<Recognition | null>(null)
  const interactionFlag = useRef(false)

  useEffect(() => {
    const id = registerPageVisit()
    setVisitorId(id)

    const timer = window.setTimeout(() => {
      setLoadingModel(false)
    }, 1300)

    return () => window.clearTimeout(timer)
  }, [])

  const editionLabel = useMemo(
    () => `极速${selectedColor.label} x ${selectedWheel.label}`,
    [selectedColor.label, selectedWheel.label],
  )

  const markInteractionOnce = () => {
    if (!visitorId || interactionFlag.current) return
    interactionFlag.current = true
    markInteraction(visitorId)
  }

  const askGuide = async (rawText: string) => {
    const text = rawText.trim()
    if (!text || asking) return

    const baseHistory = messages.slice(-6)
    const userMessage: ChatMessage = { role: 'user', source: 'fallback', text }
    setMessages((prev) => [...prev, userMessage])
    setInputText('')
    setAsking(true)

    if (visitorId) {
      markGuideConversation(visitorId)
    }

    try {
      const answer = await askExperienceGuide({
        colorLabel: selectedColor.label,
        wheelLabel: selectedWheel.label,
        userMessage: text,
        history: baseHistory,
      })

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          source: answer.source,
          text: answer.reply,
        },
      ])
      setHighlights(answer.highlights)
      setViewMode(answer.viewMode)

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utter = new SpeechSynthesisUtterance(answer.reply)
        utter.lang = 'zh-CN'
        utter.rate = 1.02
        window.speechSynthesis.speak(utter)
      }
    } finally {
      setAsking(false)
    }
  }

  const startListening = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor || listening) return

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim()
      if (!transcript) return
      setInputText(transcript)
      askGuide(transcript)
    }

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  return (
    <main className="relative min-h-screen px-4 pb-16 pt-4 md:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-3">
        <p className="text-xs font-semibold tracking-[0.22em] text-slate-300 md:text-sm">SOHU x XIAOMI EV</p>
        <Link
          to={CTA_URL}
          onClick={() => {
            if (visitorId) {
              markBookingClick(visitorId)
            }
          }}
          className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-semibold text-white hover:opacity-90 md:text-sm"
        >
          预约线下试驾
        </Link>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-[1.3fr_0.9fr]">
        <article className="glass-panel relative min-h-[420px] overflow-hidden rounded-2xl md:min-h-[620px]">
          {loadingModel ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#060b11]">
              <p className="headline text-lg font-bold text-slate-200">定义你的超感时刻</p>
              <p className="mt-2 text-sm text-slate-400">正在加载沉浸式展厅...</p>
              <div className="mt-4 h-1.5 w-52 overflow-hidden rounded-full bg-slate-700/50">
                <div className="h-full w-full origin-left animate-pulse bg-sky-400" />
              </div>
            </div>
          ) : null}

          <CarShowroomCanvas
            selectedColor={selectedColor}
            selectedWheel={selectedWheel}
            viewMode={viewMode}
            onDragStart={markInteractionOnce}
          />

          <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-black/35 px-3 py-2 text-xs text-slate-300">
            语音提问可自动切换视角
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-black/45 px-3 py-2 text-xs text-slate-300">
            当前视角: {viewMode === 'interior' ? '内饰' : viewMode === 'front' ? '车头' : viewMode === 'rear' ? '车尾' : '外观'}
          </div>
        </article>

        <aside className="glass-panel rounded-2xl p-4 md:p-5">
          <h1 className="headline text-2xl font-extrabold text-slate-100 md:text-4xl">AI 产品体验官</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300 md:text-base">
            通过语音或文本提问，AI 会作为沉浸式导游实时讲解配置并切换视角，最终引导你预约线下试驾。
          </p>

          <div className="mt-4 rounded-lg border border-slate-400/20 bg-slate-900/40 p-3">
            <p className="text-xs text-slate-400">当前配置</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{editionLabel}</p>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs tracking-wider text-slate-400">车漆颜色</p>
            <div className="flex gap-2">
              {paintColors.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedColor(item)
                    markInteractionOnce()
                  }}
                  className={`h-10 flex-1 rounded-lg border text-xs transition ${
                    item.id === selectedColor.id
                      ? 'border-sky-300 bg-slate-900/90 text-slate-100'
                      : 'border-slate-500/30 bg-slate-900/40 text-slate-300'
                  }`}
                >
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.hex }} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs tracking-wider text-slate-400">轮毂样式</p>
            <div className="grid gap-2">
              {wheelStyles.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedWheel(item)
                    markInteractionOnce()
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    item.id === selectedWheel.id
                      ? 'border-sky-300 bg-slate-800/90 text-slate-100'
                      : 'border-slate-500/30 bg-slate-900/40 text-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-400/20 bg-[#08131f] p-3">
            <p className="text-xs text-slate-400">推荐讲解要点</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              {highlights.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <section className="glass-panel mx-auto mt-5 w-full max-w-6xl rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-100">与 AI 产品体验官对话</h2>
          <div className="flex gap-2">
            <button
              onClick={listening ? stopListening : startListening}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold md:text-sm ${
                listening
                  ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-100'
                  : 'border-slate-300/30 bg-slate-900/40 text-slate-200'
              }`}
            >
              {listening ? '停止语音' : '语音提问'}
            </button>
            <Link
              to={CTA_URL}
              onClick={() => {
                if (visitorId) {
                  markBookingClick(visitorId)
                }
              }}
              className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 md:text-sm"
            >
              预约线下试驾
            </Link>
          </div>
        </div>

        <div className="mt-4 h-[260px] overflow-y-auto rounded-lg border border-slate-400/20 bg-[#06111a] p-3">
          <div className="space-y-2">
            {messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-6 ${
                  msg.role === 'assistant'
                    ? 'bg-slate-700/40 text-slate-100'
                    : 'ml-auto bg-sky-500/80 text-white'
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>
        </div>

        <form
          className="mt-3 flex flex-col gap-2 md:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            askGuide(inputText)
          }}
        >
          <input
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder="例如：帮我切到内饰视角，并推荐适合通勤的配置"
            className="w-full rounded-lg border border-slate-300/25 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-300"
          />
          <button
            type="submit"
            disabled={asking}
            className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {asking ? '思考中...' : '发送'}
          </button>
        </form>
      </section>

      <footer className="mx-auto mt-6 w-full max-w-6xl px-1 text-xs text-slate-500">
        本页面为搜狐汽车创新广告 Demo 测试，车辆参数与外观请以官方实际发布为准。
      </footer>
    </main>
  )
}
