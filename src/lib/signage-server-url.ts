function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "")
}

export function getSignageRemoteBaseUrl(request: Request) {
  const forceLocal =
    request.headers.get("x-dashadmin-local-signage") === "1"
    || new URL(request.url).searchParams.get("localSignage") === "1"

  if (forceLocal) {
    return null
  }

  const configured = process.env.DASHADMIN_SERVER_URL?.trim()
  if (!configured) return null

  try {
    const requestUrl = new URL(request.url)
    const remoteUrl = new URL(normalizeBaseUrl(configured))

    if (requestUrl.host === remoteUrl.host) {
      return null
    }

    return remoteUrl.toString()
  } catch {
    return null
  }
}

export async function proxyJsonRequest(request: Request, targetUrl: string) {
  const body = await request.text()

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") || "application/json",
    },
    body,
    cache: "no-store",
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  })
}

export async function proxyEventStream(targetUrl: string) {
  const response = await fetch(targetUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    },
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
