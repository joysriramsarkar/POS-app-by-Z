/**
 * Safe API fetch wrapper that handles JSON parsing errors gracefully
 * Prevents "Unexpected token '<'" errors when APIs return HTML error responses
 */
export async function safeJsonFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; ok: boolean; error?: string; status: number }> {
  try {
    const response = await fetch(url, options);
    const status = response.status;

    if (!response.ok) {
      try {
        const errorData = await response.json();
        return {
          data: null,
          ok: false,
          error: errorData.error || `HTTP ${status}`,
          status,
        };
      } catch (_parseErr) {
        // Response is not JSON (likely HTML error page)
        return {
          data: null,
          ok: false,
          error: `Server error: ${response.statusText}`,
          status,
        };
      }
    }

    try {
      const data = await response.json();
      return {
        data,
        ok: true,
        status,
      };
    } catch (parseErr) {
      return {
        data: null,
        ok: false,
        error: 'Failed to parse response JSON',
        status,
      };
    }
  } catch (fetchErr) {
    return {
      data: null,
      ok: false,
      error: fetchErr instanceof Error ? fetchErr.message : 'Network error',
      status: 0,
    };
  }
}
