import { apiUrl } from "../config";

/** Error thrown for any failed API call. `message` is the backend's `{ error }` text when present. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type TokenGetter = () => Promise<string | null>;

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T = void>(path: string): Promise<T>;
}

async function readError(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
  } catch {
    // Non-JSON error body; fall through to the status text.
  }
  return response.statusText || `Request failed (${response.status})`;
}

/**
 * Thin fetch wrapper around the backend at `VITE_API_URL`.
 * Attaches `Authorization: Bearer <Clerk session token>` whenever `getToken` yields one.
 */
export function createApiClient(getToken: TokenGetter): ApiClient {
  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    if (!apiUrl) throw new ApiError(0, "VITE_API_URL is not configured.");

    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = await getToken().catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(`${apiUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw new ApiError(0, "Could not reach the server. Please try again.");
    }

    if (!response.ok) throw new ApiError(response.status, await readError(response));
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
    delete: (path) => request("DELETE", path)
  };
}

export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
