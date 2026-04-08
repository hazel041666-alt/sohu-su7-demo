export type VehicleCategory = '轿车' | 'SUV' | 'MPV' | '跑车' | '皮卡' | '轻客/商用车' | '其他'

export type PowerType = '燃油' | '纯电' | '插混' | '增程' | '柴油' | '其他'

export type DrivingScene = '通勤' | '家用' | '长途'

export type PaintColor = {
  id: string
  label: string
  hex: string
}

export type WheelStyle = {
  id: string
  label: string
  roughness: number
  metalness: number
}

export type ViewMode = 'exterior' | 'front' | 'rear' | 'interior'

export type GuideResult = {
  reply: string
  viewMode: ViewMode
  source: 'doubao' | 'fallback'
  highlights: string[]
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  source: 'doubao' | 'fallback'
  text: string
}

export type CarModel = {
  id: string
  brand: string
  model: string
  category: VehicleCategory
  seats: number
  powerType: PowerType
  priceMinWan: number
  priceMaxWan: number
  level: string
  sizeMm: string
  wheelbaseMm: number
  rangeOrFuel: string
  adas: string
  cockpit: string
  sourceUrl: string
  officialUrl?: string
}

export type UserDemand = {
  budgetMinWan?: number
  budgetMaxWan?: number
  scene?: DrivingScene
  powerPreference?: PowerType
  brandInclude?: string[]
  brandExclude?: string[]
  seats?: 5 | 7
  smartNeed?: string
}

export type ParsedDemand = {
  mode: 'ai' | 'form_fallback'
  demand: UserDemand
  message: string
}

export type Recommendation = {
  car: CarModel
  score: number
  reason: string
}

export type AdvisorResponse = {
  parsed: ParsedDemand
  recommendations: Recommendation[]
  comparison: CarModel[]
  sourceDisclaimer: string
  fetchedAt: string
  sourceStats: {
    totalModels: number
    liveScraped: number
    seeded: number
  }
}

export type AnalyticsState = {
  uv: number
  totalPageViews: number
  interactiveUsers: number
  guidedUsers: number
  bookingClicks: number
  formSubmits: number
  sessions: Record<string, SessionFlags>
}

export type SessionFlags = {
  interacted: boolean
  guided: boolean
  bookingClicked: boolean
  formSubmitted: boolean
}
