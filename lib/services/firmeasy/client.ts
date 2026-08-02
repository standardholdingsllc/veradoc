import "server-only";

import { serverEnv } from "@/lib/env/server";
import type {
  CreateDocumentParams,
  FirmEasyAuthResponse,
  FirmEasyDocumentResponse,
  FirmEasyErrorResponse,
  FirmEasyWebhookResponse,
} from "./types";

const REQUEST_TIMEOUT_MS = 30_000;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

export class FirmEasyClient {
  private baseUrl: string;
  private integrationToken: string;
  private email: string;
  private password: string;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config?: {
    baseUrl?: string;
    integrationToken?: string;
    email?: string;
    password?: string;
  }) {
    this.baseUrl = config?.baseUrl ?? serverEnv.FIRMEASY_API_BASE_URL ?? "";
    this.integrationToken =
      config?.integrationToken ?? serverEnv.FIRMEASY_USER_INTEGRATION_TOKEN ?? "";
    this.email = config?.email ?? serverEnv.FIRMEASY_EMAIL ?? "";
    this.password = config?.password ?? serverEnv.FIRMEASY_PASSWORD ?? "";
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  async authenticate(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return;
    }

    const url = `${this.baseUrl}/auth/${this.integrationToken}/login`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const error = await this.parseError(res);
      throw new FirmEasyApiError(
        `Authentication failed: ${error}`,
        res.status,
      );
    }

    const data: FirmEasyAuthResponse = await res.json();
    this.accessToken = data.access;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - TOKEN_REFRESH_BUFFER_MS;
  }

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  async createDocument(
    params: CreateDocumentParams,
  ): Promise<FirmEasyDocumentResponse> {
    return this.request<FirmEasyDocumentResponse>("POST", "/documents", params);
  }

  async getDocument(
    token: string,
    includes?: ("signers" | "tracking" | "user")[],
  ): Promise<FirmEasyDocumentResponse> {
    const searchParams = new URLSearchParams();
    if (includes) {
      for (const inc of includes) {
        searchParams.append("include[]", inc);
      }
    }
    const qs = searchParams.toString();
    const path = `/documents/${token}${qs ? `?${qs}` : ""}`;
    return this.request<FirmEasyDocumentResponse>("GET", path);
  }

  async getSignedPdf(signedFileUrl: string): Promise<Buffer> {
    await this.authenticate();

    const res = await fetch(signedFileUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2),
    });

    if (!res.ok) {
      throw new FirmEasyApiError(
        `Failed to download signed PDF: ${res.status}`,
        res.status,
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ---------------------------------------------------------------------------
  // Webhooks
  // ---------------------------------------------------------------------------

  async createWebhook(
    targetUrl: string,
    event: string,
  ): Promise<FirmEasyWebhookResponse> {
    return this.request<FirmEasyWebhookResponse>("POST", "/webhooks", {
      target_url: targetUrl,
      event,
    });
  }

  async listWebhooks(): Promise<FirmEasyWebhookResponse[]> {
    const data = await this.request<
      FirmEasyWebhookResponse[] | { data: FirmEasyWebhookResponse[] }
    >("GET", "/webhooks");
    return Array.isArray(data) ? data : data.data;
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.request<unknown>("DELETE", `/webhooks/${id}`);
  }

  // ---------------------------------------------------------------------------
  // Internal HTTP helpers
  // ---------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    await this.authenticate();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    };

    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);

    if (!res.ok) {
      const error = await this.parseError(res);
      throw new FirmEasyApiError(
        `FirmEasy API ${method} ${path} failed: ${error}`,
        res.status,
      );
    }

    if (res.status === 204) return undefined as unknown as T;

    return res.json() as Promise<T>;
  }

  private async parseError(res: Response): Promise<string> {
    try {
      const data: FirmEasyErrorResponse = await res.json();
      return data.message ?? data.detail ?? JSON.stringify(data.errors) ?? `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}

export class FirmEasyApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "FirmEasyApiError";
  }
}
