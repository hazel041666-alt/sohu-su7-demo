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

export type CopyResult = {
  text: string
  source: 'doubao' | 'fallback'
}

export type AnalyticsState = {
  uv: number
  totalPageViews: number
  interactiveUsers: number
  posterClicks: number
  postersGenerated: number
  qrScans: number
  formSubmits: number
  sessions: Record<string, SessionFlags>
}

export type SessionFlags = {
  interacted: boolean
  posterClicked: boolean
  posterGenerated: boolean
  qrScanned: boolean
  formSubmitted: boolean
}
