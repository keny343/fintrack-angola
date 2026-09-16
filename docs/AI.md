# AI

A language model writes the monthly summary. It does not compute it.

## Why it is built this way

A finance app that invents a number is worse than one that says nothing. Someone
reading "vais poupar 300 000 Kz" will plan around it, and no disclaimer undoes
that. So the numbers are produced by SQL and pure functions in
`domain/insights.ts`, and the model is handed the finished figures with one job:
choose the words.

That leaves the obvious failure mode — a model that quietly changes a figure
while rephrasing, rounds 204 999,50 to "cerca de 205 mil", or adds up two
amounts on its own. Asking it nicely in the prompt is not enough, so the answer
is checked before anyone sees it.

## The check

`domain/narration.ts` builds the list of figures the answer is allowed to
contain: the month's totals in kwanzas, the percentages, the counts, and the
date. Centavos never enter the list, since nobody reads 20499950 out loud.

Every number in the answer is then pulled out and compared against that list.
The comparison is numeric, so `204 999,50`, `204<NBSP>999,50` and `204999,5` all
count as the same figure and formatting is never the reason for a rejection. Any
figure that is not on the list — invented, rounded or computed by the model —
throws the whole answer away.

```
GET /api/insights/narration
  → { text, source: 'model', provider: 'gpt-4o-mini' }        answer accepted
  → { text, source: 'deterministic', rejected_figures: [...] } answer discarded
```

A discarded answer is recorded in `audit_events` as
`insights.narration.rejected`, so the rate of a given model inventing figures is
a number you can go and look at rather than a feeling.

## When there is no model

The endpoint answers the same shape whether or not a model is reachable. With no
key configured, a timeout, an HTTP error, an empty answer or a failed check, the
text comes from `deterministicSummary`, assembled from the same insight
sentences the dashboard shows. It is duller and always true.

The dashboard only shows the paragraph when a model wrote it: the deterministic
version repeats the cards directly underneath it, so on that page it would say
everything twice. The API keeps answering either way, because a caller reading
JSON has no cards to read.

## Cost

- **Nothing is asked about an empty month.** No movements, nothing to narrate.
- **Answers are cached for 10 minutes**, keyed by user, month and the figures
  themselves — so a refresh is free, and a new transaction is not.
- **`max_tokens` is capped** (250 by default): three sentences need no more.
- **A daily ceiling per user** (`AI_DAILY_LIMIT`, 40 by default) means a held
  down refresh key cannot run up a bill. Past it, the summary is deterministic.
- **The call gives up after `AI_TIMEOUT_MS`** (8s). A dashboard cannot wait on a
  slow vendor.

## Privacy

What leaves the server: the month, the totals, the percentages, and the category
names behind each insight.

What never leaves it: transaction notes, account names, goal names, e-mail
addresses, the user's name, and any identifier. The prompt is assembled from
computed figures, not from rows, so there is nothing to leak by accident — and a
test asserts the prompt carries no `@` and no account name.

## Configuration

Any OpenAI-compatible chat endpoint works, which covers most vendors and local
runtimes. Without `AI_API_KEY` the feature stays dormant and the API still
answers.

```bash
AI_API_KEY=sk-...                      # absent: deterministic summary only
AI_BASE_URL=https://api.openai.com/v1  # any OpenAI-compatible endpoint
AI_MODEL=gpt-4o-mini
AI_MAX_TOKENS=250
AI_TIMEOUT_MS=8000
AI_DAILY_LIMIT=40
```

The provider is an interface with a single `complete` method
(`services/narration.ts`), so the vendor is configuration rather than code, and
the tests hand over a stub instead of reaching the network.
