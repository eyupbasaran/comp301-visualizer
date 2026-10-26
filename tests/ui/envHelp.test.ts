// The help dialog's examples must show what its text says.

import { describe, expect, it } from 'vitest';
import { CALL_EXAMPLE, draw, LOOKUP_EXAMPLE } from '../../src/ui/EnvHelp';

const frames = (example: typeof LOOKUP_EXAMPLE) =>
  draw(example)
    .diagram.cards.filter((c) => c.kind === 'frame')
    .map((c) => `${c.name} ${c.parts.map((p) => p.text).join('')} ${c.emphasis}`)
    .sort();

describe('environment help', () => {
  it('shows a lookup walking the chain to the first frame that binds the name', () => {
    expect(draw(LOOKUP_EXAMPLE).call).toBe('(value-of «x» ρ2) = ⌈3⌉');
    expect(frames(LOOKUP_EXAMPLE)).toEqual(['ρ0 i=1  v=5  x=10 chain', 'ρ1 x = 3 chain', 'ρ2 y = 4 current']);
  });

  it("shows a call's frame on the closure's saved env, with the caller's frame grey", () => {
    const { call, diagram } = draw(CALL_EXAMPLE);
    expect(call).toBe('(value-of «a» ρ3) = ⌈5⌉');
    // As the text says: the body runs in ρ3 → ρ1 → ρ0 and skips the grey f = ●.
    expect(frames(CALL_EXAMPLE)).toEqual(['ρ0 i=1  v=5  x=10 chain', 'ρ1 a = 5 chain', 'ρ2 f = ● muted', 'ρ3 z = 1 current']);
    const closure = diagram.cards.find((c) => c.kind === 'closure');
    expect(closure?.caption).toBe('running');
    expect(diagram.labels.map((l) => l.text)).toEqual(['saved env']);
  });
});
