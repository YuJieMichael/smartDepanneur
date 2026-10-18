import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { EvalAgent, EvalSummary, runStoreAgentEval } from './store-agent.eval';

// Usage:
//   npm run eval:agent                  deterministic local agent, no API key
//   npm run eval:agent -- --agent=openai  live OpenAI agent (OPENAI_API_KEY)

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function row(name: string, summary: EvalSummary) {
  return {
    group: name,
    cases: summary.cases,
    pass: percent(summary.passRate),
    routing: percent(summary.routingAccuracy),
    language: percent(summary.languageAccuracy),
    grounded: percent(summary.groundingRate),
    facts: percent(summary.requiredFactRate),
    fallback: percent(summary.fallbackRate),
    'p50 ms': summary.p50LatencyMs,
    'p95 ms': summary.p95LatencyMs,
  };
}

async function main() {
  const agentArg = process.argv.find((arg) => arg.startsWith('--agent='));
  const agent = (agentArg?.split('=')[1] ?? 'local') as EvalAgent;
  if (agent !== 'local' && agent !== 'openai') {
    throw new Error('--agent must be local or openai');
  }

  const report = await runStoreAgentEval({ agent });

  console.log(
    `Store Agent eval: ${agent}${report.model ? ` (${report.model})` : ''}`,
  );
  console.table([
    row('overall', report.overall),
    ...Object.entries(report.bySplit).map(([name, summary]) => row(name, summary)),
    ...Object.entries(report.byLanguage).map(([name, summary]) =>
      row(name, summary),
    ),
  ]);

  const failures = report.results.filter((result) => !result.passed);
  if (failures.length > 0) {
    console.log(`\n${failures.length} failing case(s):`);
    for (const failure of failures) {
      const reasons = [
        !failure.routedCorrectly &&
          `routed to ${failure.toolsUsed.join(', ')} instead of ${failure.expectedTool}`,
        !failure.languageCorrect && 'wrong answer language',
        !failure.grounded &&
          `ungrounded products: ${failure.ungroundedProducts.join(', ')}`,
        !failure.mentionsRequiredFacts &&
          `missing: ${failure.missingFacts.join(', ')}`,
      ].filter(Boolean);
      console.log(`- ${failure.id} "${failure.question}": ${reasons.join('; ')}`);
    }
  }

  const outDir = path.join(__dirname, 'results');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `store-agent-${agent}.json`);
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nFull report: ${path.relative(process.cwd(), outFile)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
