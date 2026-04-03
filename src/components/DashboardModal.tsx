import {
  Funnel,
  FunnelChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

type DashboardModalProps = {
  open: boolean
  onClose: () => void
  metrics: {
    uv: number
    interactiveUsers: number
    posterClicks: number
    postersGenerated: number
    formSubmits: number
    interactionRate: number
    posterCtr: number
    leadConversion: number
  }
}

export default function DashboardModal({ open, onClose, metrics }: DashboardModalProps) {
  if (!open) return null

  const data = [
    { name: '页面 UV', value: metrics.uv, fill: '#5AA5E0' },
    { name: '互动用户', value: metrics.interactiveUsers, fill: '#6EBEE9' },
    { name: '点击生成海报', value: metrics.posterClicks, fill: '#8ED0F2' },
    { name: '海报生成', value: metrics.postersGenerated, fill: '#A8DFFA' },
    { name: '提交留资', value: metrics.formSubmits, fill: '#D6F0FF' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-panel w-full max-w-4xl rounded-2xl p-4 md:p-7">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-100 md:text-2xl">转化漏斗看板</h2>
          <button
            className="rounded-lg border border-slate-400/40 px-3 py-1 text-sm text-slate-200 hover:bg-white/10"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard title="3D互动完成率" value={`${metrics.interactionRate}%`} subtitle="分子: 互动用户 / 分母: UV" />
          <StatCard title="海报生成点击率" value={`${metrics.posterCtr}%`} subtitle="分子: 生成海报点击 / 分母: UV" />
          <StatCard title="扫码留资转化率" value={`${metrics.leadConversion}%`} subtitle="分子: 提交表单 / 分母: 海报生成" />
        </div>

        <div className="mt-5 h-[290px] w-full rounded-xl border border-slate-400/20 bg-[#06111a] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip
                contentStyle={{
                  background: '#0C1A26',
                  border: '1px solid rgba(145, 176, 204, 0.35)',
                }}
              />
              <Funnel dataKey="value" data={data} isAnimationActive>
                <LabelList position="right" fill="#D7ECFF" stroke="none" dataKey="name" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

type StatCardProps = {
  title: string
  value: string
  subtitle: string
}

function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-300/20 bg-[#091726] p-3">
      <p className="text-xs tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  )
}
