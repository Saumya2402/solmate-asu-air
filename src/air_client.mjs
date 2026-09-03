const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export class AirApiError extends Error {
  constructor(message, { status, retryable = false } = {}) {
    super(message);
    this.name = "AirApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

export class AirClient {
  constructor({
    apiKey = process.env.OPENAI_API_KEY,
    baseUrl = process.env.OPENAI_BASE_URL || "https://openai.rc.asu.edu/v1",
    timeoutMs = 45_000,
    retries = 1,
    retryDelayMs = 500,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for live AIR mode.");
    if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
    this.retries = retries;
    this.retryDelayMs = retryDelayMs;
    this.fetchImpl = fetchImpl;
  }

  async chat({ model, messages, temperature = 0, maxTokens = 800, signal }) {
    if (!model) throw new Error("An AIR model ID is required.");
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("At least one chat message is required.");
    }

    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener("abort", cancel, { once: true });
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const startedAt = Date.now();
      try {
        const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const retryable = TRANSIENT_STATUS.has(response.status);
          throw new AirApiError(`AIR request failed with HTTP ${response.status}.`, {
            status: response.status,
            retryable,
          });
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim() === "") {
          throw new AirApiError("AIR returned an empty assistant response.");
        }
        return {
          content,
          model: payload.model || model,
          usage: payload.usage || null,
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        const normalized = error?.name === "AbortError"
          ? signal?.aborted
            ? new AirApiError("AIR request was canceled.", { retryable: false })
            : new AirApiError(`AIR request timed out after ${this.timeoutMs} ms.`, { retryable: true })
          : error;
        lastError = normalized;
        if (attempt === this.retries || normalized.retryable !== true) throw normalized;
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
      }
    }
    throw lastError;
  }
}
