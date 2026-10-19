import type { ProviderType } from "../shared/schemas.js";

export type ProviderConfig = {
  id: string;
  name: string;
  type: ProviderType;
  model: string;
  baseUrl: string;
  apiVersion: string;
  apiKey: string;
};

export type LlmRequest = {
  task: string;
  system: string;
  user: string;
  maxTokens: number;
  /** Structured input for the mock provider (ignored by real providers). */
  meta?: unknown;
};

export type LlmResult = { text: string; inputTokens: number; outputTokens: number };

export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const trimSlash = (s: string) => s.replace(/\/+$/, "");

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") throw new LlmError(`Timeout setelah ${Math.round(timeoutMs / 1000)} detik`);
    throw new LlmError(`Gagal terhubung: ${e?.cause?.code || e?.cause?.message || e?.message || "network error"}`);
  }
  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const detail = json?.error?.message || json?.message || json?.error || raw.slice(0, 300);
    throw new LlmError(`HTTP ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}`, res.status);
  }
  if (!json) throw new LlmError("Respons provider bukan JSON");
  return json;
}

function openAiText(json: any): LlmResult {
  const choice = json?.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== "string" || !text) {
    throw new LlmError(choice?.finish_reason ? `Respons kosong (finish_reason: ${choice.finish_reason})` : "Respons kosong");
  }
  return {
    text,
    inputTokens: json?.usage?.prompt_tokens ?? json?.usage?.input_tokens ?? 0,
    outputTokens: json?.usage?.completion_tokens ?? json?.usage?.output_tokens ?? 0,
  };
}

export async function callProvider(p: ProviderConfig, req: LlmRequest, timeoutMs: number): Promise<LlmResult> {
  switch (p.type) {
    case "anthropic": {
      const json = await postJson(
        `${trimSlash(p.baseUrl || "https://api.anthropic.com")}/v1/messages`,
        { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01" },
        {
          model: p.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
        },
        timeoutMs,
      );
      const text = (json?.content ?? [])
        .filter((c: any) => c?.type === "text")
        .map((c: any) => c.text)
        .join("");
      if (!text) throw new LlmError(`Respons kosong (stop_reason: ${json?.stop_reason ?? "?"})`);
      return { text, inputTokens: json?.usage?.input_tokens ?? 0, outputTokens: json?.usage?.output_tokens ?? 0 };
    }

    case "openai": {
      const json = await postJson(
        `${trimSlash(p.baseUrl || "https://api.openai.com/v1")}/chat/completions`,
        { authorization: `Bearer ${p.apiKey}` },
        {
          model: p.model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: req.maxTokens,
        },
        timeoutMs,
      );
      return openAiText(json);
    }

    case "azure-openai": {
      // Azure OpenAI / Azure AI Foundry. `model` is the deployment name.
      // API version "v1" uses the newer /openai/v1 endpoint; otherwise the classic deployments endpoint.
      const base = trimSlash(p.baseUrl).replace(/\/openai(\/v1)?$/, "");
      if (!base) throw new LlmError("Base URL (endpoint Azure) belum diisi");
      const v1 = (p.apiVersion || "").toLowerCase() === "v1";
      const url = v1
        ? `${base}/openai/v1/chat/completions`
        : `${base}/openai/deployments/${encodeURIComponent(p.model)}/chat/completions?api-version=${encodeURIComponent(p.apiVersion || "2024-10-21")}`;
      const json = await postJson(
        url,
        { "api-key": p.apiKey },
        {
          ...(v1 ? { model: p.model } : {}),
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: req.maxTokens,
        },
        timeoutMs,
      );
      return openAiText(json);
    }

    case "openai-compatible": {
      // OpenRouter, Ollama, LM Studio, Groq, Azure AI model inference, etc.
      if (!p.baseUrl) throw new LlmError("Base URL belum diisi");
      const json = await postJson(
        `${trimSlash(p.baseUrl)}/chat/completions`,
        p.apiKey ? { authorization: `Bearer ${p.apiKey}` } : {},
        {
          model: p.model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          max_tokens: req.maxTokens,
        },
        timeoutMs,
      );
      return openAiText(json);
    }

    case "gemini": {
      const json = await postJson(
        `${trimSlash(p.baseUrl || "https://generativelanguage.googleapis.com")}/v1beta/models/${encodeURIComponent(p.model)}:generateContent`,
        { "x-goog-api-key": p.apiKey },
        {
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: req.maxTokens },
        },
        timeoutMs,
      );
      const cand = json?.candidates?.[0];
      const text = (cand?.content?.parts ?? []).map((x: any) => x?.text ?? "").join("");
      if (!text) throw new LlmError(`Respons kosong (finishReason: ${cand?.finishReason ?? json?.promptFeedback?.blockReason ?? "?"})`);
      return {
        text,
        inputTokens: json?.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: json?.usageMetadata?.candidatesTokenCount ?? 0,
      };
    }

    case "mock": {
      const { mockResponse } = await import("../ai/mock.js");
      await new Promise((r) => setTimeout(r, 150));
      if (p.model === "fail") throw new LlmError("Mock provider dikonfigurasi untuk gagal (model = fail)", 503);
      const text = JSON.stringify(mockResponse(req.task, req.meta));
      return { text, inputTokens: Math.ceil((req.system.length + req.user.length) / 4), outputTokens: Math.ceil(text.length / 4) };
    }

    default:
      throw new LlmError(`Tipe provider tidak dikenal: ${p.type}`);
  }
}
