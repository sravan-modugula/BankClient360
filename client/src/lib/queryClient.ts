import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { eventTracker } from "./eventTracker";
import { AuditEventType } from "@shared/auditEvents";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function trackApiError(method: string, url: string, status: number, durationMs: number) {
  if (status >= 400) {
    eventTracker.track(AuditEventType.ERR_API, {
      action: `API error: ${method} ${url} → ${status}`,
      outcome: 'error',
      metadata: { method, url, status, durationMs },
      module: 'api-client',
    });
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const start = Date.now();

  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      "x-correlation-id": correlationId,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  const duration = Date.now() - start;
  trackApiError(method, url, res.status, duration);

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const correlationId = crypto.randomUUID();
    const start = Date.now();
    const url = queryKey.join("/") as string;

    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "x-correlation-id": correlationId,
      },
    });

    const duration = Date.now() - start;
    trackApiError("GET", url, res.status, duration);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
