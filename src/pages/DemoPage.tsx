import { useMemo, useState } from 'react'
import { fetchAdvisorResult } from '../lib/ai'
import { markGuideConversation, markInteraction, registerPageVisit } from '../lib/analytics'
import type { AdvisorResponse, DrivingScene, PowerType, UserDemand } from '../lib/types'

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
  const [result, setResult] = useState<AdvisorResponse | null>(null)
  const visitorId = useMemo(() => registerPageVisit(), [])

  const submit = async () => {
    if (loading) return

    setLoading(true)
    markInteraction(visitorId)

    try {
      const data = await fetchAdvisorResult({
        query,
        filters,
      })

      setResult(data)
      markGuideConversation(visitorId)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_10%,rgba(174,45,0,.2),transparent_38%),radial-gradient(circle_at_88%_20%,rgba(6,79,133,.22),transparent_42%),linear-gradient(168deg,#071019_0%,#0e1f2d_42%,#11293a_100%)] px-4 pb-14 pt-6 md:px-8">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-sky-100/20 bg-[#0b1926]/90 p-5 shadow-[0_16px_70px_rgba(3,9,14,.45)] md:p-8">
        <p className="text-xs font-semibold tracking-[0.24em] text-sky-200/80">SOHU AUTO ADVISOR DEMO</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight text-slate-100 md:text-5xl">中国在售车型智能选购助手</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300 md:text-base">
          支持自然语言输入和高级筛选，覆盖轿车、SUV、MPV、跑车、皮卡与轻客/商用车，实时抓取搜狐汽车并结合品牌官网信息进行推荐。
        </p>

        <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200/15 bg-[#0f2436] p-4 md:grid-cols-[1.15fr_0.85fr] md:p-5">
          <div>
            <p className="text-sm font-semibold text-slate-100">自然语言需求</p>
            <textarea
              rows={5}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：预算20-30万，家用为主，希望7座SUV，优先插混，不考虑某些品牌，智驾要高速领航"
              className="mt-3 w-full rounded-xl border border-slate-300/25 bg-[#08131d] px-3 py-3 text-sm leading-6 text-slate-100 outline-none focus:border-amber-300"
            />
            <p className="mt-2 text-xs text-slate-400">AI 解析失败时会自动回退到规则+表单筛选并提示你补充条件。</p>
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
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '正在抓取并推荐...' : '生成 3 条推荐 + 对比表'}
          </button>
          {result ? (
            <p className="text-xs text-slate-400">
              解析模式：{result.parsed.mode === 'ai' ? 'AI自然语言解析' : '表单/规则回退'} ｜ 数据条目：{result.sourceStats.totalModels} ｜ 更新时间：
              {new Date(result.fetchedAt).toLocaleString('zh-CN')}
            </p>
          ) : null}
        </div>
      </section>

      {result ? (
        <section className="mx-auto mt-5 grid w-full max-w-6xl gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-slate-200/15 bg-[#0b1d2c]/90 p-5">
            <h2 className="text-xl font-bold text-slate-100">推荐结果（默认 Top 3）</h2>
            <p className="mt-1 text-xs text-slate-400">{result.parsed.message}</p>

            <div className="mt-4 space-y-3">
              {result.recommendations.length ? (
                result.recommendations.map((item) => (
                  <div key={item.car.id} className="rounded-xl border border-slate-200/10 bg-[#0e2538] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-amber-200">{item.car.brand} {item.car.model}</h3>
                        <p className="mt-1 text-xs text-slate-300">{item.car.category} ｜ {item.car.level} ｜ 推荐分 {item.score}</p>
                      </div>
                      <a
                        href={item.car.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-sky-300/40 px-3 py-1 text-xs text-sky-200 hover:bg-sky-500/10"
                      >
                        打开搜狐来源
                      </a>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">推荐理由：{item.reason}</p>
                    <p className="mt-2 text-xs text-slate-300">
                      关键参数：{item.car.priceMinWan}-{item.car.priceMaxWan}万 ｜ {item.car.powerType} ｜ {item.car.seats}座 ｜ {item.car.rangeOrFuel}
                    </p>
                    {item.car.officialUrl ? (
                      <a
                        href={item.car.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-emerald-200 underline-offset-2 hover:underline"
                      >
                        查看品牌官网参数（冲突时已优先官网）
                      </a>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-amber-300/20 bg-amber-500/5 p-3 text-sm text-amber-100">
                  当前筛选条件下暂无匹配车型，请放宽预算或品牌限制后重试。
                </div>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/15 bg-[#0b1d2c]/90 p-5">
            <h2 className="text-xl font-bold text-slate-100">关键参数对比</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs text-slate-200">
                <thead>
                  <tr className="border-b border-slate-400/30 text-slate-300">
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
                    <tr key={`cmp-${car.id}`} className="border-b border-slate-500/20 align-top">
                      <td className="px-2 py-2 font-semibold text-slate-100">{car.brand} {car.model}</td>
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

      <footer className="mx-auto mt-6 w-full max-w-6xl rounded-xl border border-slate-300/15 bg-[#091622] px-4 py-3 text-xs leading-6 text-slate-400">
        数据来源于搜狐汽车，价格与配置以官方最新信息为准。若搜狐与品牌官网参数冲突，系统优先展示官网信息。
      </footer>
    </main>
  )
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
      <span className="text-xs text-slate-300">{props.label}</span>
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
        className="mt-1 w-full rounded-lg border border-slate-300/25 bg-[#08131d] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-300"
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
      <span className="text-xs text-slate-300">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300/25 bg-[#08131d] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-300"
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
      <span className="text-xs text-slate-300">{props.label}</span>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300/25 bg-[#08131d] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-300"
      />
    </label>
  )
}
