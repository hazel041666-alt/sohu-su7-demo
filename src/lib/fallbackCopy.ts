const pools = [
  (edition: string) => `不是每一抹蓝都能让街道降噪，${edition}把速度感写成了城市里最安静的锋芒。`,
  (edition: string) => `当夜色亮起，${edition}就像一条会呼吸的电流弧线，出场即主角。`,
  (edition: string) => `把通勤交给效率，把审美交给${edition}，今天的方向盘只服务于热爱。`,
]

export function buildFallbackCopy(edition: string) {
  const pick = Math.floor(Math.random() * pools.length)
  return pools[pick](edition)
}
