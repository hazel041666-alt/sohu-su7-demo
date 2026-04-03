import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import CarShowroomCanvas from '../components/CarShowroomCanvas'
import DashboardModal from '../components/DashboardModal'
import { generateAdCopy } from '../lib/ai'
import {
  getMetrics,
  markInteraction,
  markPosterClick,
  markPosterGenerated,
  markQrScanned,
  registerPageVisit,
} from '../lib/analytics'
import { paintColors, wheelStyles } from '../lib/catalog'
import { buildPoster } from '../lib/poster'

const CTA_URL =
  '/mock-reservation?utm_source=sohu_ai_demo&utm_medium=poster_qr&utm_campaign=su7_launch'

export default function DemoPage() {
  const [selectedColor, setSelectedColor] = useState(paintColors[0])
  const [selectedWheel, setSelectedWheel] = useState(wheelStyles[0])
  const [copyText, setCopyText] = useState('')
  const [copySource, setCopySource] = useState<'doubao' | 'fallback' | null>(null)
  const [posterDataUrl, setPosterDataUrl] = useState('')
  const [loadingModel, setLoadingModel] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [visitorId, setVisitorId] = useState('')
  const [metricsVersion, setMetricsVersion] = useState(0)
  const stageRef = useRef<HTMLDivElement | null>(null)
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

  const metrics = useMemo(() => {
    const snapshot = getMetrics()
    return {
      uv: snapshot.raw.uv,
      interactiveUsers: snapshot.raw.interactiveUsers,
      posterClicks: snapshot.raw.posterClicks,
      postersGenerated: snapshot.raw.postersGenerated,
      formSubmits: snapshot.raw.formSubmits,
      interactionRate: snapshot.ratios.interactionRate,
      posterCtr: snapshot.ratios.posterCtr,
      leadConversion: snapshot.ratios.leadConversion,
    }
  }, [metricsVersion])

  const markInteractionOnce = () => {
    if (!visitorId || interactionFlag.current) return
    interactionFlag.current = true
    markInteraction(visitorId)
    setMetricsVersion((value) => value + 1)
  }

  const handleGenerate = async () => {
    if (!visitorId || generating) return
    const sourceCanvas = stageRef.current?.querySelector('canvas')
    if (!sourceCanvas) return

    markPosterClick(visitorId)
    setMetricsVersion((value) => value + 1)
    setGenerating(true)

    try {
      const copy = await generateAdCopy({
        colorLabel: selectedColor.label,
        wheelLabel: selectedWheel.label,
      })
      setCopyText(copy.text)
      setCopySource(copy.source)

      const poster = await buildPoster({
        sourceCanvas,
        copyText: copy.text,
        editionLabel,
        qrUrl: `${window.location.origin}${CTA_URL}`,
      })

      setPosterDataUrl(poster)
      markPosterGenerated(visitorId)
      setMetricsVersion((value) => value + 1)
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!posterDataUrl) return
    const anchor = document.createElement('a')
    anchor.href = posterDataUrl
    anchor.download = `su7_poster_${Date.now()}.png`
    anchor.click()
  }

  return (
    <main className="relative min-h-screen px-4 pb-16 pt-4 md:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-3">
        <p className="text-xs font-semibold tracking-[0.22em] text-slate-300 md:text-sm">SOHU x XIAOMI EV</p>
        <button
          onClick={() => setDashboardOpen(true)}
          className="rounded-lg border border-slate-300/30 px-3 py-1 text-xs text-slate-200 hover:bg-white/10 md:text-sm"
        >
          View Dashboard
        </button>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-[1.3fr_0.9fr]">
        <article className="glass-panel relative min-h-[420px] overflow-hidden rounded-2xl md:min-h-[600px]" ref={stageRef}>
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
            onDragStart={markInteractionOnce}
          />

          <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-black/35 px-3 py-2 text-xs text-slate-300">
            拖拽旋转 | 双指缩放
          </div>
        </article>

        <aside className="glass-panel rounded-2xl p-4 md:p-5">
          <h1 className="headline text-2xl font-extrabold text-slate-100 md:text-4xl">定义你的超感时刻</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300 md:text-base">
            在 3D 展厅完成你的专属选配，AI 将实时生成一张社交海报，扫码即可预约试驾。
          </p>

          <div className="mt-5">
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

          <div className="mt-4 rounded-lg border border-slate-400/20 bg-slate-900/40 p-3">
            <p className="text-xs text-slate-400">当前专属版本</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{editionLabel}</p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? '正在生成海报...' : '生成专属海报'}
          </button>

          {copyText ? (
            <div className="mt-4 rounded-lg border border-slate-400/20 bg-[#08131f] p-3">
              <p className="text-xs text-slate-400">AI 文案 {copySource === 'fallback' ? '(本地兜底)' : '(Doubao)'}</p>
              <p className="mt-2 text-sm leading-6 text-slate-100">{copyText}</p>
            </div>
          ) : null}
        </aside>
      </section>

      {posterDataUrl ? (
        <section className="glass-panel mx-auto mt-5 w-full max-w-6xl rounded-2xl p-4 md:p-6">
          <h2 className="text-lg font-bold text-slate-100">你的 AI 裂变海报已生成</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-[300px_1fr]">
            <img src={posterDataUrl} className="w-[280px] rounded-xl border border-slate-300/20" alt="AI Poster" />
            <div className="flex flex-col justify-between gap-3">
              <p className="text-sm text-slate-300">
                海报已自动嵌入 UTM 追踪二维码，可直接用于“分享裂变到预约试驾”闭环验证。
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownload}
                  className="rounded-lg border border-slate-300/40 px-4 py-2 text-sm hover:bg-white/10"
                >
                  下载海报
                </button>
                <Link
                  to={CTA_URL}
                  onClick={() => {
                    if (visitorId) {
                      markQrScanned(visitorId)
                      setMetricsVersion((value) => value + 1)
                    }
                  }}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  模拟扫码进入留资页
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <footer className="mx-auto mt-6 w-full max-w-6xl px-1 text-xs text-slate-500">
        本页面为搜狐汽车创新广告 Demo 测试，车辆参数与外观请以官方实际发布为准。
      </footer>

      <DashboardModal
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        metrics={metrics}
      />
    </main>
  )
}
