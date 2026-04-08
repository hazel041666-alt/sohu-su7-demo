import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchAdvisorResult } from '../lib/ai'
import { markGuideConversation, markInteraction, registerPageVisit } from '../lib/analytics'
import type { AdvisorResponse, DrivingScene, PowerType, UserDemand } from '../lib/types'

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

type VoiceTurn = {
  role: 'user' | 'assistant'
  text: string
}

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => Recognition
    SpeechRecognition?: new () => Recognition
  }
}

const defaultFilters: UserDemand = {
  budgetMinWan: undefined,
  budgetMaxWan: undefined,
  scene: undefined,
  powerPreference: undefined,
  brandInclude: undefined,
  brandExclude: undefined,
  seats: undefined,
  smartNeed: '',
}

export default function DemoPage() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<UserDemand>(defaultFilters)
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceSessionActive, setVoiceSessionActive] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceTurns, setVoiceTurns] = useState<VoiceTurn[]>([])
  const [result, setResult] = useState<AdvisorResponse | null>(null)
  const visitorId = useMemo(() => registerPageVisit(), [])
  const recognitionRef = useRef<Recognition | null>(null)
  const voiceSessionActiveRef = useRef(false)

  useEffect(() => {
    return () => {
      voiceSessionActiveRef.current = false
      recognitionRef.current?.stop()
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const submit = async (nextQuery?: string) => {
    if (loading) return
    const finalQuery = typeof nextQuery === 'string' ? nextQuery : query

    setLoading(true)
    markInteraction(visitorId)

    try {
      const data = await fetchAdvisorResult({
        query: finalQuery,
        filters,
      })

      setResult(data)
      setQuery(finalQuery)
      markGuideConversation(visitorId)
      speakRecommendationSummary(data)
    } finally {
      setLoading(false)
    }
  }

  const startListening = () => {
    if (listening || loading) return

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!RecognitionCtor) {
      setVoiceStatus('当前浏览器不支持语音输入，请使用 Chrome 或 Edge。')
      return
    }

    const recognition = new RecognitionCtor()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: any) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim()
      if (!transcript) {
        setVoiceStatus('未识别到有效语音，请再试一次。')
        return
      }

      setVoiceStatus(`已识别：${transcript}`)
      setQuery(transcript)
      if (voiceSessionActiveRef.current) {
        void runVoiceGuideTurn(transcript)
      } else {
        void submit(transcript)
      }
    }

    recognition.onerror = () => {
      setVoiceStatus('语音识别失败，请检查麦克风权限后重试。')
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)

      if (!voiceSessionActiveRef.current || speaking || loading) {
        return
      }

      window.setTimeout(() => {
        if (voiceSessionActiveRef.current && !speaking && !loading) {
          startListening()
        }
      }, 260)
    }

    recognitionRef.current = recognition
    setListening(true)
    setVoiceStatus('正在聆听，请说出你的选车需求。')

    try {
      recognition.start()
    } catch {
      setListening(false)
      setVoiceStatus('语音识别启动失败，请刷新后重试。')
    }
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
    setVoiceStatus('已停止语音输入。')
  }

  const startVoiceSession = () => {
    setVoiceTurns([])
    setVoiceSessionActive(true)
    voiceSessionActiveRef.current = true
    setVoiceStatus('实时语音导购已开启，请直接说出你的需求。')
    startListening()
  }

  const stopVoiceSession = () => {
    setVoiceSessionActive(false)
    voiceSessionActiveRef.current = false
    stopListening()
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
    setVoiceStatus('实时语音导购已结束。')
  }

  const runVoiceGuideTurn = async (transcript: string) => {
    const userText = transcript.trim()
    if (!userText) return

    setVoiceTurns((prev) => [...prev, { role: 'user' as const, text: userText }].slice(-12))

    const composedQuery = composeVoiceQuery(userText, voiceTurns)
    setLoading(true)

    try {
      markInteraction(visitorId)
      const data = await fetchAdvisorResult({
        query: composedQuery,
        filters,
      })

      setResult(data)
      markGuideConversation(visitorId)

      const assistantText = buildVoiceReplyText(data)
      setVoiceTurns((prev) => [...prev, { role: 'assistant' as const, text: assistantText }].slice(-12))
      speakText(assistantText, {
        onStart: () => setSpeaking(true),
        onEnd: () => {
          setSpeaking(false)
          if (voiceSessionActiveRef.current) {
            startListening()
          }
        },
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-14 pt-6 md:px-8">
      <div className="pointer-events-none absolute -left-16 top-10 h-72 w-72 rounded-full bg-[#7fccff]/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-28 h-80 w-80 rounded-full bg-[#b8d9ff]/45 blur-3xl" />

      <section className="relative mx-auto w-full max-w-6xl rounded-3xl border border-[#d6e7fb] bg-white/90 p-5 shadow-[0_24px_80px_rgba(10,70,140,.12)] md:p-8">
        <p className="text-xs font-semibold tracking-[0.24em] text-[#2b6cb6]">SOHU AUTO ADVISOR DEMO</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight text-[#12263a] md:text-5xl">搜狐汽车智能导购</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-[#4c647e] md:text-base">
          支持自然语言输入和高级筛选，覆盖轿车、SUV、MPV、跑车、皮卡与轻客/商用车，实时抓取搜狐汽车并结合品牌官网信息进行推荐。
        </p>

        <div className="mt-6 grid gap-4 rounded-2xl border border-[#dce9f8] bg-gradient-to-br from-[#fbfdff] via-[#f6faff] to-[#eef5ff] p-4 md:grid-cols-[1.15fr_0.85fr] md:p-5">
          <div>
            <p className="text-sm font-semibold text-[#123053]">自然语言需求</p>
            <textarea
              rows={5}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：预算20-30万，家用为主，希望7座SUV，优先插混，不考虑某些品牌，智驾要高速领航"
              className="mt-3 w-full rounded-xl border border-[#cddff6] bg-white px-3 py-3 text-sm leading-6 text-[#132a43] outline-none transition focus:border-[#2e7fe8] focus:ring-2 focus:ring-[#8ec2ff]/35"
            />
            <p className="mt-2 text-xs text-[#5f7891]">AI 解析失败时会自动回退到规则+表单筛选并提示你补充条件。</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <NumberInput
              label="预算下限（万）"
              value={filters.budgetMinWan}
              onChange={(value) => setFilters((prev) => ({ ...prev, budgetMinWan: value }))}
            />
            <NumberInput
              label="预算上限（万）"
              value={filters.budgetMaxWan}
              onChange={(value) => setFilters((prev) => ({ ...prev, budgetMaxWan: value }))}
            />
            <SelectInput
              label="用车场景"
              value={filters.scene || ''}
              options={['', '通勤', '家用', '长途']}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, scene: value ? (value as DrivingScene) : undefined }))
              }
            />
            <SelectInput
              label="动力偏好"
              value={filters.powerPreference || ''}
              options={['', '燃油', '纯电', '插混', '增程', '柴油']}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, powerPreference: value ? (value as PowerType) : undefined }))
              }
            />
            <SelectInput
              label="座位需求"
              value={String(filters.seats || '')}
              options={['', '5', '7']}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, seats: value === '7' ? 7 : value === '5' ? 5 : undefined }))
              }
            />
            <TextInput
              label="品牌偏好（逗号分隔）"
              value={filters.brandInclude?.join(',') || ''}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, brandInclude: splitBrandInput(value) }))
              }
            />
            <TextInput
              label="排斥品牌（逗号分隔）"
              value={filters.brandExclude?.join(',') || ''}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, brandExclude: splitBrandInput(value) }))
              }
            />
            <TextInput
              label="智驾/车机要求"
              value={filters.smartNeed || ''}
              onChange={(value) => setFilters((prev) => ({ ...prev, smartNeed: value }))}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void submit()}
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-[#1d78ea] to-[#0e5fd1] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_26px_rgba(14,95,209,.28)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '正在抓取并推荐...' : '生成 3 条推荐 + 对比表'}
            </button>
            <button
              onClick={listening ? stopListening : startListening}
              disabled={loading || voiceSessionActive}
              className={`rounded-xl px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                listening ? 'bg-[#0ea77f] hover:bg-[#0b9671]' : 'bg-[#2c8cf2] hover:bg-[#1f7ddd]'
              }`}
            >
              {listening ? '停止语音输入' : '语音输入并推荐'}
            </button>
            <button
              onClick={voiceSessionActive ? stopVoiceSession : startVoiceSession}
              disabled={loading && !voiceSessionActive}
              className={`rounded-xl px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                voiceSessionActive ? 'bg-[#f05a77] hover:bg-[#e94a69]' : 'bg-[#5a73f7] hover:bg-[#4c65eb]'
              }`}
            >
              {voiceSessionActive ? '结束实时语音导购' : '开启实时语音导购'}
            </button>
          </div>
          {result ? (
            <p className="text-xs text-[#5f7891]">
              解析模式：{result.parsed.mode === 'ai' ? 'AI自然语言解析' : '表单/规则回退'} ｜ 数据条目：{result.sourceStats.totalModels} ｜ 更新时间：
              {new Date(result.fetchedAt).toLocaleString('zh-CN')}
            </p>
          ) : null}
        </div>
        {voiceStatus ? <p className="mt-2 text-xs text-[#2466b8]">{voiceStatus}</p> : null}
        {voiceSessionActive ? (
          <p className="mt-1 text-xs text-[#5765cc]">当前模式：实时语音导购（自动聆听 → 推荐 → 语音播报 → 继续聆听）</p>
        ) : null}

        {voiceTurns.length ? (
          <div className="mt-4 rounded-xl border border-[#d7e1ff] bg-[#f8f7ff] p-3">
            <p className="text-xs font-semibold tracking-wide text-[#5a6bcf]">语音导购对话</p>
            <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
              {voiceTurns.map((turn, index) => (
                <div
                  key={`${turn.role}-${index}`}
                  className={`rounded-lg px-3 py-2 text-xs leading-6 ${
                    turn.role === 'assistant'
                      ? 'bg-[#5a73f7]/15 text-[#3342a7]'
                      : 'bg-[#2f86ee]/15 text-[#1759a2]'
                  }`}
                >
                  {turn.role === 'assistant' ? 'AI导购：' : '你：'} {turn.text}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {result ? (
        <section className="mx-auto mt-5 grid w-full max-w-6xl gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-[#d9e8fb] bg-white/92 p-5 shadow-[0_14px_34px_rgba(17,67,120,.08)]">
            <h2 className="text-xl font-bold text-[#163452]">推荐结果（默认 Top 3）</h2>
            <p className="mt-1 text-xs text-[#5f7891]">{result.parsed.message}</p>

            <div className="mt-4 space-y-3">
              {result.recommendations.length ? (
                result.recommendations.map((item) => (
                  <div key={item.car.id} className="rounded-xl border border-[#dbe8f8] bg-gradient-to-br from-[#ffffff] to-[#f4f9ff] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-[#15457a]">{item.car.brand} {item.car.model}</h3>
                        <p className="mt-1 text-xs text-[#55708a]">{item.car.category} ｜ {item.car.level} ｜ 推荐分 {item.score}</p>
                      </div>
                      <a
                        href={item.car.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-[#9bc4f4] bg-white px-3 py-1 text-xs text-[#2068b7] transition hover:bg-[#edf5ff]"
                      >
                        打开搜狐来源
                      </a>
                    </div>
                    <p className="mt-2 text-sm text-[#1f3d59]">推荐理由：{item.reason}</p>
                    <p className="mt-2 text-xs text-[#597189]">
                      关键参数：{item.car.priceMinWan}-{item.car.priceMaxWan}万 ｜ {item.car.powerType} ｜ {item.car.seats}座 ｜ {item.car.rangeOrFuel}
                    </p>
                    {item.car.officialUrl ? (
                      <a
                        href={item.car.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-[#0a8a63] underline-offset-2 hover:underline"
                      >
                        查看品牌官网参数（冲突时已优先官网）
                      </a>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-[#f3d7a6] bg-[#fff6e8] p-3 text-sm text-[#965d08]">
                  当前筛选条件下暂无匹配车型，请放宽预算或品牌限制后重试。
                </div>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-[#d9e8fb] bg-white/92 p-5 shadow-[0_14px_34px_rgba(17,67,120,.08)]">
            <h2 className="text-xl font-bold text-[#163452]">关键参数对比</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs text-[#24415e]">
                <thead>
                  <tr className="border-b border-[#d5e4f5] text-[#4f6c88]">
                    <th className="px-2 py-2">车型</th>
                    <th className="px-2 py-2">指导价</th>
                    <th className="px-2 py-2">级别</th>
                    <th className="px-2 py-2">车身尺寸/轴距</th>
                    <th className="px-2 py-2">座位数</th>
                    <th className="px-2 py-2">动力类型</th>
                    <th className="px-2 py-2">续航或油耗</th>
                    <th className="px-2 py-2">智驾</th>
                    <th className="px-2 py-2">车机</th>
                  </tr>
                </thead>
                <tbody>
                  {result.comparison.map((car) => (
                    <tr key={`cmp-${car.id}`} className="border-b border-[#e4eef9] align-top">
                      <td className="px-2 py-2 font-semibold text-[#173a5e]">{car.brand} {car.model}</td>
                      <td className="px-2 py-2">{car.priceMinWan}-{car.priceMaxWan}万</td>
                      <td className="px-2 py-2">{car.level}</td>
                      <td className="px-2 py-2">{car.sizeMm} / {car.wheelbaseMm || '待补充'}mm</td>
                      <td className="px-2 py-2">{car.seats}</td>
                      <td className="px-2 py-2">{car.powerType}</td>
                      <td className="px-2 py-2">{car.rangeOrFuel}</td>
                      <td className="px-2 py-2">{car.adas}</td>
                      <td className="px-2 py-2">{car.cockpit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      <footer className="mx-auto mt-6 w-full max-w-6xl rounded-xl border border-[#d7e8fc] bg-white/85 px-4 py-3 text-xs leading-6 text-[#5f7891] shadow-[0_10px_30px_rgba(18,81,152,.08)]">
        数据来源于搜狐汽车，价格与配置以官方最新信息为准。若搜狐与品牌官网参数冲突，系统优先展示官网信息。
      </footer>
    </main>
  )
}

function speakRecommendationSummary(data: AdvisorResponse) {
  if (!('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()

  const topCars = data.recommendations.slice(0, 3)
  const summary = topCars.length
    ? `为你推荐${topCars.map((item) => `${item.car.brand}${item.car.model}`).join('、')}。你可以打开来源查看详细参数。`
    : '当前条件下暂无匹配车型，你可以放宽预算或减少品牌限制后再试。'

  const utter = new SpeechSynthesisUtterance(summary)
  utter.lang = 'zh-CN'
  utter.rate = 1.02
  window.speechSynthesis.speak(utter)
}

function buildVoiceReplyText(data: AdvisorResponse) {
  const topCars = data.recommendations.slice(0, 3)
  if (!topCars.length) {
    return '当前条件下暂时没有匹配车型。你可以放宽预算、减少品牌限制，或者告诉我更偏向SUV还是轿车。'
  }

  const modelNames = topCars.map((item) => `${item.car.brand}${item.car.model}`).join('、')
  const first = topCars[0]
  return `我先给你推荐${modelNames}。首推${first.car.brand}${first.car.model}，价格大约${first.car.priceMinWan}到${first.car.priceMaxWan}万，${first.reason}。你想继续看空间、智驾还是能耗对比？`
}

function composeVoiceQuery(latestUtterance: string, history: VoiceTurn[]) {
  const recentUserInputs = history
    .filter((item) => item.role === 'user')
    .slice(-3)
    .map((item) => item.text)

  if (!recentUserInputs.length) return latestUtterance
  return `历史需求：${recentUserInputs.join('；')}。最新需求：${latestUtterance}`
}

function speakText(
  text: string,
  hooks?: {
    onStart?: () => void
    onEnd?: () => void
  },
) {
  if (!('speechSynthesis' in window)) {
    hooks?.onEnd?.()
    return
  }

  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'zh-CN'
  utter.rate = 1.03
  utter.onstart = () => hooks?.onStart?.()
  utter.onend = () => hooks?.onEnd?.()
  utter.onerror = () => hooks?.onEnd?.()
  window.speechSynthesis.speak(utter)
}

function splitBrandInput(value: string) {
  const list = value
    .split(/[，,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  return list.length ? list : undefined
}

type NumberInputProps = {
  label: string
  value?: number
  onChange: (value: number | undefined) => void
}

function NumberInput(props: NumberInputProps) {
  return (
    <label className="block">
      <span className="text-xs text-[#4d6781]">{props.label}</span>
      <input
        type="number"
        value={typeof props.value === 'number' ? props.value : ''}
        onChange={(event) => {
          const next = event.target.value
          if (!next.trim()) {
            props.onChange(undefined)
            return
          }
          const n = Number(next)
          props.onChange(Number.isFinite(n) ? n : undefined)
        }}
        className="mt-1 w-full rounded-lg border border-[#cfe1f8] bg-white px-3 py-2 text-sm text-[#1c3550] outline-none transition focus:border-[#2e7fe8] focus:ring-2 focus:ring-[#90c4ff]/30"
      />
    </label>
  )
}

type SelectInputProps = {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}

function SelectInput(props: SelectInputProps) {
  return (
    <label className="block">
      <span className="text-xs text-[#4d6781]">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-[#cfe1f8] bg-white px-3 py-2 text-sm text-[#1c3550] outline-none transition focus:border-[#2e7fe8] focus:ring-2 focus:ring-[#90c4ff]/30"
      >
        <option value="">不限</option>
        {props.options
          .filter((item) => item)
          .map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
      </select>
    </label>
  )
}

type TextInputProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

function TextInput(props: TextInputProps) {
  return (
    <label className="block sm:col-span-2 md:col-span-1">
      <span className="text-xs text-[#4d6781]">{props.label}</span>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-[#cfe1f8] bg-white px-3 py-2 text-sm text-[#1c3550] outline-none transition focus:border-[#2e7fe8] focus:ring-2 focus:ring-[#90c4ff]/30"
      />
    </label>
  )
}
