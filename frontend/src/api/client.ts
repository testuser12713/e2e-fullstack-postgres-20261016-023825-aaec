import type { ErrorBody } from "../types";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.replace(/\/+$/, "");
  }
  return DEFAULT_API_BASE_URL;
}

export const API_BASE_URL: string = resolveApiBaseUrl();

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[];

  constructor(
    status: number,
    code: string,
    message: string,
    details: unknown[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const body = (value as { error: unknown }).error;
  return typeof body === "object" && body !== null;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let body: unknown = undefined;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    if (isErrorBody(body)) {
      throw new ApiError(
        response.status,
        body.error.code,
        body.error.message,
        body.error.details ?? [],
      );
    }

    throw new ApiError(
      response.status,
      "internal_error",
      `Anfrage fehlgeschlagen (${response.status}).`,
      [],
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
