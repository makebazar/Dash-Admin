function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "")
}

type RetryableFetchError = Error & { cause?: { code?: string } }

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

async function sleep(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function isRetryableFetchError(error: unknown) {
  const err = error as RetryableFetchError
  const code = err?.cause?.code
  return (
    err?.name === "AbortError"
    || code === "UND_ERR_SOCKET"
    || code === "ECONNRESET"
    || code === "EPIPE"
    || code === "ETIMEDOUT"
    || code === "ECONNREFUSED"
    || code === "ENOTFOUND"
    || code === "EAI_AGAIN"
  )
}

function getFetchErrorCode(error: unknown) {
  const err = error as RetryableFetchError
  return err?.cause?.code || null
}

async function fetchWithRetries(
  targetUrl: string,
  init: RequestInit,
  options: { timeoutMs: number; retries: number }
) {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    const controller = new AbortController()
    const abortFromInit = () => controller.abort()
    if (init.signal) {
      if (init.signal.aborted) {
        controller.abort()
      } else {
        init.signal.addEventListener("abort", abortFromInit, { once: true })
      }
    }
    const timer = setTimeout(() => controller.abort(), options.timeoutMs)

    try {
      return await fetch(targetUrl, { ...init, signal: controller.signal })
    } catch (error) {
      lastError = error
      if (init.signal?.aborted) {
        throw error
      }
      if (attempt >= options.retries || !isRetryableFetchError(error)) {
        throw error
      }
      await sleep(150 * Math.pow(2, attempt))
    } finally {
      clearTimeout(timer)
      if (init.signal && !init.signal.aborted) {
        init.signal.removeEventListener("abort", abortFromInit)
      }
    }
  }

  throw lastError
}

export async function proxyJsonRequest(request: Request, targetUrl: string) {
  try {
    const body = await request.text()

    const response = await fetchWithRetries(
      targetUrl,
      {
        method: request.method,
        headers: {
          "Content-Type": request.headers.get("content-type") || "application/json",
        },
        body,
        cache: "no-store",
        signal: request.signal,
      },
      { timeoutMs: 15000, retries: 2 }
    )

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const isTimeout = (error as Error)?.name === "AbortError" && !request.signal.aborted
    const status = isTimeout ? 504 : 502
    const code = getFetchErrorCode(error)
    const message = (error as Error)?.message || String(error)
    console.error("Signage proxy JSON error:", { status, code, message })
    return new Response(JSON.stringify({ error: isTimeout ? "Upstream request timed out" : "Upstream request failed" }), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    })
  }
}

export async function proxyEventStream(request: Request, targetUrl: string) {
  try {
    const response = await fetchWithRetries(
      targetUrl,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        signal: request.signal,
      },
      { timeoutMs: 20000, retries: 2 }
    )

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 204 })
    }
    const code = getFetchErrorCode(error)
    const message = (error as Error)?.message || String(error)
    console.error("Signage proxy SSE error:", { code, message })
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: upstreamError\ndata: ${JSON.stringify({ ok: false, ts: Date.now() })}\n\n`
          )
        )
        controller.close()
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  }
}
