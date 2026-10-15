import {
  InsightAgentTool,
  InsightLanguage,
  InsightsService,
} from '../src/insights/insights.service';
import { createFixturePrisma, FIXTURE_PRODUCT_NAMES } from './fixture-store';
import { STORE_AGENT_EVAL_CASES, StoreAgentEvalCase } from './store-agent.cases';

export type EvalAgent = 'local' | 'openai';

export interface CaseResult {
  id: string;
  split: StoreAgentEvalCase['split'];
  language: InsightLanguage;
  question: string;
  expectedTool: InsightAgentTool;
  toolsUsed: InsightAgentTool[];
  provider: string;
  fallbackReason: string | null;
  latencyMs: number;
  routedCorrectly: boolean;
  languageCorrect: boolean;
  // Every catalogue product the answer names was returned by a tool it called.
  grounded: boolean;
  ungroundedProducts: string[];
  mentionsRequiredFacts: boolean;
  missingFacts: string[];
  passed: boolean;
  answer: string;
}

export interface EvalSummary {
  cases: number;
  passRate: number;
  routingAccuracy: number;
  languageAccuracy: number;
  groundingRate: number;
  requiredFactRate: number;
  fallbackRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
}

export interface EvalReport {
  agent: EvalAgent;
  model: string | null;
  ranAt: string;
  overall: EvalSummary;
  bySplit: Record<string, EvalSummary>;
  byLanguage: Record<string, EvalSummary>;
  results: CaseResult[];
}

const FRENCH_MARKERS = /\b(le|la|les|des|du|est|sont|aucun|aucune|produits?|ventes?|et|en|magasin|jours)\b/gi;
const ENGLISH_MARKERS = /\b(the|is|are|and|in|of|no|sold|units|products?|sales?|days|store)\b/gi;
const CJK = /[一-鿿]/g;

export function detectLanguage(answer: string): InsightLanguage {
  // Product names are English in every language, so they are ignored.
  const text = FIXTURE_PRODUCT_NAMES.reduce(
    (current, name) => current.split(name).join(' '),
    answer,
  );
  const cjk = text.match(CJK)?.length ?? 0;
  if (cjk >= 4) return 'zh';
  const french = text.match(FRENCH_MARKERS)?.length ?? 0;
  const english = text.match(ENGLISH_MARKERS)?.length ?? 0;
  return french > english ? 'fr' : 'en';
}

// A product counts as mentioned when its leading word appears as a whole word
// ("Red Bull" -> "Red"), which also catches shortened names in model answers.
const PRODUCT_PATTERNS = FIXTURE_PRODUCT_NAMES.map((name) => ({
  name,
  pattern: new RegExp(
    `(^|[^\\p{L}])${name.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`,
    'iu',
  ),
}));

function mentionedProducts(text: string) {
  return PRODUCT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ name }) => name,
  );
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

function rate(results: CaseResult[], key: keyof CaseResult) {
  return results.length === 0
    ? 0
    : results.filter((result) => result[key] === true).length / results.length;
}

export function summarize(results: CaseResult[]): EvalSummary {
  const latencies = results.map((result) => result.latencyMs);
  return {
    cases: results.length,
    passRate: rate(results, 'passed'),
    routingAccuracy: rate(results, 'routedCorrectly'),
    languageAccuracy: rate(results, 'languageCorrect'),
    groundingRate: rate(results, 'grounded'),
    requiredFactRate: rate(results, 'mentionsRequiredFacts'),
    fallbackRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.fallbackReason !== null).length /
          results.length,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
  };
}

function groupBy(results: CaseResult[], key: 'split' | 'language') {
  const groups: Record<string, CaseResult[]> = {};
  for (const result of results) {
    (groups[result[key]] ??= []).push(result);
  }
  return Object.fromEntries(
    Object.entries(groups).map(([name, group]) => [name, summarize(group)]),
  );
}

export async function runStoreAgentEval(
  options: { agent?: EvalAgent; cases?: StoreAgentEvalCase[] } = {},
): Promise<EvalReport> {
  const agent = options.agent ?? 'local';
  const cases = options.cases ?? STORE_AGENT_EVAL_CASES;
  const previousKey = process.env.OPENAI_API_KEY;
  if (agent === 'local') {
    delete process.env.OPENAI_API_KEY;
  } else if (!previousKey) {
    throw new Error('OPENAI_API_KEY is required for --agent=openai');
  }

  const service = new InsightsService(createFixturePrisma());
  const operator = { id: 1, email: 'eval@smartdepanneur.local' };
  const results: CaseResult[] = [];

  try {
    for (const testCase of cases) {
      const started = performance.now();
      const response = await service.ask(
        testCase.question,
        testCase.language,
        operator,
      );
      const latencyMs = Math.round(performance.now() - started);

      const toolOutputs = await Promise.all(
        response.toolsUsed.map((tool) => service.executeAgentTool(tool)),
      );
      const available = new Set(mentionedProducts(JSON.stringify(toolOutputs)));
      const ungroundedProducts = mentionedProducts(response.answer).filter(
        (name) => !available.has(name),
      );
      const missingFacts = (testCase.mustMention ?? []).filter(
        (fact) => !response.answer.toLowerCase().includes(fact.toLowerCase()),
      );

      const routedCorrectly = response.toolsUsed.includes(testCase.expectedTool);
      const languageCorrect =
        detectLanguage(response.answer) === testCase.language;
      const grounded = ungroundedProducts.length === 0;
      const mentionsRequiredFacts = missingFacts.length === 0;

      results.push({
        id: testCase.id,
        split: testCase.split,
        language: testCase.language,
        question: testCase.question,
        expectedTool: testCase.expectedTool,
        toolsUsed: response.toolsUsed,
        provider: response.provider,
        fallbackReason: agent === 'local' ? null : response.fallbackReason,
        latencyMs,
        routedCorrectly,
        languageCorrect,
        grounded,
        ungroundedProducts,
        mentionsRequiredFacts,
        missingFacts,
        passed:
          routedCorrectly && languageCorrect && grounded && mentionsRequiredFacts,
        answer: response.answer,
      });
    }
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousKey;
    }
  }

  return {
    agent,
    model: agent === 'openai' ? process.env.OPENAI_MODEL || 'gpt-4o-mini' : null,
    ranAt: new Date().toISOString(),
    overall: summarize(results),
    bySplit: groupBy(results, 'split'),
    byLanguage: groupBy(results, 'language'),
    results,
  };
}
