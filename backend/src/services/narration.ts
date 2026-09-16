/**
 * Serves the monthly summary, with or without a language model.
 *
 * The provider is an interface with one method, so the API key, the vendor and
 * the model are configuration rather than code, and the tests can hand over a
 * stub. Everything that can go wrong — no key, a timeout, an error, an answer
 * that invents figures — ends in the deterministic summary, which means the
 * endpoint answers the same shape whether or not a model is reachable.
 */

import { audit } from '../middleware/auth.js';
import {
  buildNarrationRequest,
  checkNarration,
  deterministicSummary,
} from '../domain/narration.js';
import { monthInsights } from './insights.js';
import type { Insight, InsightMetrics } from '../domain/insights.js';

export type NarrationProvider = {
  name: string;
  complete(request: { system: string; user: string; maxTokens: number }): Promise<string>;
};

/** Why the answer is the one being served — useful in the UI and in the logs. */
export type NarrationSource = 'model' | 'deterministic';

export type Narration = {
  year_month: string;
  text: string;
  source: NarrationSource;
  provider: string | null;
  /** Set when a model answered but the answer was discarded. */
  rejected_figures?: number[];
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
/** A ceiling per user per day, so a held-down refresh key cannot run up a bill. */
const DAILY_CALL_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);

type CacheEntry = { narration: Narration; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const callsToday = new Map<string, number>();

/** The insights are part of the key: new numbers must produce a new summary. */
function cacheKey(userId: number, yearMonth: string, insights: Insight[]): string {
  const shape = insights.map((i) => `${i.id}:${JSON.stringify(i.facts)}`).join('|');
  return `${userId}:${yearMonth}:${shape}`;
}

function remember(key: string, narration: Narration): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Rough but bounded: drop the oldest insertion.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { narration, expiresAt: Date.now() + CACHE_TTL_MS });
}

function withinDailyLimit(userId: number): boolean {
  const key = `${userId}:${new Date().toISOString().slice(0, 10)}`;
  const used = callsToday.get(key) ?? 0;
  if (used >= DAILY_CALL_LIMIT) return false;
  callsToday.set(key, used + 1);
  return true;
}

/** Speaks to any OpenAI-compatible chat endpoint, which covers most vendors. */
export function openAiCompatibleProvider(): NarrationProvider | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  const model = (process.env.AI_MODEL || 'gpt-4o-mini').trim();
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 8000);

  return {
    name: model,
    async complete({ system, user, maxTokens }) {
      // A dashboard cannot wait on a slow vendor: give up and let the caller
      // fall back to the summary it already has.
      const abort = AbortSignal.timeout(timeoutMs);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: abort,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`Provider answered ${res.status}`);
      }
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Provider answered without text');
      return text;
    },
  };
}

export async function narrateMonth(
  userId: number,
  yearMonth: string,
  options: {
    provider?: NarrationProvider | null;
    todayIso?: string;
    /** Metrics and insights are usually fetched here, but the route may pass them. */
    computed?: { metrics: InsightMetrics; insights: Insight[] };
  } = {}
): Promise<Narration> {
  const { metrics, insights } =
    options.computed ?? (await monthInsights(userId, yearMonth, options.todayIso));

  const fallback: Narration = {
    year_month: yearMonth,
    text: deterministicSummary(yearMonth, metrics, insights),
    source: 'deterministic',
    provider: null,
  };

  const provider = options.provider === undefined ? openAiCompatibleProvider() : options.provider;
  if (!provider) return fallback;

  // A month with no movements has nothing to narrate. Asking anyway costs money
  // and invites nonsense like "boas contas, sobraram 0,00 Kz".
  if (insights.length === 1 && insights[0].id === 'no-data') return fallback;

  const key = cacheKey(userId, yearMonth, insights);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.narration;

  if (!withinDailyLimit(userId)) return fallback;

  const request = buildNarrationRequest(yearMonth, metrics, insights);
  let text: string;
  try {
    text = await provider.complete({
      system: request.system,
      user: request.user,
      maxTokens: Number(process.env.AI_MAX_TOKENS || 250),
    });
  } catch {
    // A model that is down, slow or out of quota is not an error the user needs
    // to see, so the month is still described — just without the new words.
    return fallback;
  }

  const check = checkNarration(text, request.allowed);
  if (!check.ok) {
    const rejected: Narration = { ...fallback, rejected_figures: check.offending };
    await audit(userId, 'insights.narration.rejected', {
      year_month: yearMonth,
      provider: provider.name,
      offending: check.offending,
    });
    remember(key, rejected);
    return rejected;
  }

  const narration: Narration = {
    year_month: yearMonth,
    text,
    source: 'model',
    provider: provider.name,
  };
  await audit(userId, 'insights.narration', { year_month: yearMonth, provider: provider.name });
  remember(key, narration);
  return narration;
}

/** Tests and long-lived processes need a way to forget. */
export function resetNarrationCache(): void {
  cache.clear();
  callsToday.clear();
}
