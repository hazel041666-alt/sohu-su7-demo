import type { AnalyticsState, SessionFlags } from './types'

const STORAGE_KEY = 'sohu_auto_advisor_metrics'
const VISITOR_KEY = 'sohu_auto_advisor_visitor_id'

const blankSession: SessionFlags = {
  interacted: false,
  guided: false,
  bookingClicked: false,
  formSubmitted: false,
}

const initialState: AnalyticsState = {
  uv: 0,
  totalPageViews: 0,
  interactiveUsers: 0,
  guidedUsers: 0,
  bookingClicks: 0,
  formSubmits: 0,
  sessions: {},
}

function readState(): AnalyticsState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return structuredClone(initialState)
  try {
    const parsed = JSON.parse(raw) as AnalyticsState
    return {
      ...initialState,
      ...parsed,
      sessions: parsed.sessions ?? {},
    }
  } catch {
    return structuredClone(initialState)
  }
}

function writeState(next: AnalyticsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

function getVisitorId() {
  const current = localStorage.getItem(VISITOR_KEY)
  if (current) return current
  const created = `v_${crypto.randomUUID()}`
  localStorage.setItem(VISITOR_KEY, created)
  return created
}

export function registerPageVisit() {
  const state = readState()
  const visitorId = getVisitorId()

  if (!state.sessions[visitorId]) {
    state.sessions[visitorId] = { ...blankSession }
    state.uv += 1
  }

  state.totalPageViews += 1
  writeState(state)
  return visitorId
}

export function markInteraction(visitorId: string) {
  const state = readState()
  if (!state.sessions[visitorId]) {
    state.sessions[visitorId] = { ...blankSession }
    state.uv += 1
  }

  if (!state.sessions[visitorId].interacted) {
    state.sessions[visitorId].interacted = true
    state.interactiveUsers += 1
  }

  writeState(state)
}

export function markGuideConversation(visitorId: string) {
  const state = readState()
  if (!state.sessions[visitorId]) {
    state.sessions[visitorId] = { ...blankSession }
    state.uv += 1
  }

  if (!state.sessions[visitorId].guided) {
    state.sessions[visitorId].guided = true
    state.guidedUsers += 1
  }

  writeState(state)
}

export function markBookingClick(visitorId: string) {
  const state = readState()
  if (!state.sessions[visitorId]) {
    state.sessions[visitorId] = { ...blankSession }
    state.uv += 1
  }

  if (!state.sessions[visitorId].bookingClicked) {
    state.sessions[visitorId].bookingClicked = true
    state.bookingClicks += 1
  }

  writeState(state)
}

export function markFormSubmitted(visitorId: string) {
  const state = readState()
  if (!state.sessions[visitorId].formSubmitted) {
    state.sessions[visitorId].formSubmitted = true
    state.formSubmits += 1
  }
  writeState(state)
}

export function getMetrics() {
  const state = readState()
  const uv = Math.max(state.uv, 1)
  const bookingClicks = Math.max(state.bookingClicks, 1)

  return {
    raw: state,
    ratios: {
      interactionRate: Math.round((state.interactiveUsers / uv) * 1000) / 10,
      guidedRate: Math.round((state.guidedUsers / uv) * 1000) / 10,
      leadConversion: Math.round((state.formSubmits / bookingClicks) * 1000) / 10,
    },
  }
}
