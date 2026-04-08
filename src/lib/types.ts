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
