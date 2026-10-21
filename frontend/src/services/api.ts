const API_BASE_URL = import.meta.env.VITE_WEBSITE_URL || ''

export type RequestOptions = Omit<RequestInit, 'body'> & { body?: any }

export async function request(path: string, opts: RequestOptions = {}) {
  const url = `${API_BASE_URL}/api${path}`
  const headers: Record<string, string> = opts.headers ? { ...(opts.headers as Record<string,string>) } : {}
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  const token = localStorage.getItem('token')
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    ...opts,
    headers,
    body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
  })

  const text = await res.text()
  let data: any = undefined
  try { data = text ? JSON.parse(text) : undefined } catch (e) { data = text }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    // FastAPI's HTTPException sends { detail }, our JSONResponses send { message }
    const message = data?.message || (typeof data?.detail === 'string' ? data.detail : '') || res.statusText
    const err: any = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

export default API_BASE_URL
