import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { markFormSubmitted, registerPageVisit } from '../lib/analytics'

export default function MockReservationPage() {
  const [search] = useSearchParams()
  const [done, setDone] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const visitorId = useMemo(() => registerPageVisit(), [])

  const utmSummary = `source=${search.get('utm_source') ?? '-'} | medium=${search.get('utm_medium') ?? '-'} | campaign=${search.get('utm_campaign') ?? '-'}`

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !phone.trim()) return
    markFormSubmitted(visitorId)
    setDone(true)
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="glass-panel w-full max-w-lg rounded-2xl p-5 md:p-7">
        <p className="text-xs tracking-[0.2em] text-slate-400">SOHU AUTO ADVISOR</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-100">预约咨询（Mock 页面）</h1>
        <p className="mt-2 text-sm text-slate-300">该页面用于演示广告转化链路，不会收集真实商业数据。</p>

        {done ? (
          <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-emerald-100">
            感谢您的预约，稍后会有专属顾问与您联系。
          </div>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={submit}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="姓名"
              className="w-full rounded-lg border border-slate-300/25 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-300"
            />
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="手机号"
              className="w-full rounded-lg border border-slate-300/25 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-300"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white"
            >
              提交预约
            </button>
          </form>
        )}

        <p className="mt-4 text-xs text-slate-500">UTM: {utmSummary}</p>

        <Link to="/" className="mt-5 inline-block text-sm text-sky-300 hover:underline">
          返回展厅
        </Link>
      </section>
    </main>
  )
}
