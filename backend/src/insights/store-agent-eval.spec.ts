import { runStoreAgentEval } from '../../eval/store-agent.eval';

// Regression gate for the deterministic fallback agent. If a change lowers
// these scores, the eval report (npm run eval:agent) shows which questions
// started failing.
describe('Store Agent eval (local fallback)', () => {
  it('keeps routing, language, and grounding quality', async () => {
    const report = await runStoreAgentEval({ agent: 'local' });

    expect(report.bySplit.dev.routingAccuracy).toBe(1);
    expect(report.bySplit.holdout.routingAccuracy).toBe(1);
    // Measured, never tuned against: the scores when each gate was added.
    expect(report.bySplit.blind.routingAccuracy).toBeGreaterThanOrEqual(24 / 36);
    expect(report.bySplit['blind-v2'].routingAccuracy).toBeGreaterThanOrEqual(26 / 27);
    expect(report.overall.languageAccuracy).toBe(1);
    expect(report.overall.groundingRate).toBe(1);
  });

  it('turns every action request into a pending proposal', async () => {
    const report = await runStoreAgentEval({ agent: 'local' });
    const actionCases = report.results.filter(
      (result) =>
        result.expectedTool.startsWith('propose_') && result.routedCorrectly,
    );

    expect(actionCases.length).toBeGreaterThan(0);
    expect(actionCases.every((result) => result.mentionsRequiredFacts)).toBe(true);
  });
});
