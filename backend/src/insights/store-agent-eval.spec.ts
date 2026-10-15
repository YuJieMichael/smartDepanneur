import { runStoreAgentEval } from '../../eval/store-agent.eval';

// Regression gate for the deterministic fallback agent. If a change lowers
// these scores, the eval report (npm run eval:agent) shows which questions
// started failing.
describe('Store Agent eval (local fallback)', () => {
  it('keeps routing, language, and grounding quality', async () => {
    const report = await runStoreAgentEval({ agent: 'local' });

    expect(report.bySplit.dev.routingAccuracy).toBe(1);
    expect(report.bySplit.holdout.routingAccuracy).toBe(1);
    // Measured, never tuned against: 24 of 36 when the gate was added.
    expect(report.bySplit.blind.routingAccuracy).toBeGreaterThanOrEqual(24 / 36);
    expect(report.overall.languageAccuracy).toBe(1);
    expect(report.overall.groundingRate).toBe(1);
  });
});
