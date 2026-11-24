import { describe, it, expect } from 'vitest';
import {
  DELIVERED,
  DESTINATION_IP,
  FIBER,
  HOPS,
  LAYERS,
  LAYER_TEXT,
  MARK_TEXT,
  PORT,
  START,
  ZONES,
  changedFields,
  historyRows,
  longestStepLine,
  markFor,
  neighbours,
  stateAt,
  stepLine,
} from '../../src/lib/explainers/packet';

describe('the packet’s journey', () => {
  it('has eleven stops, from the laptop to the web server', () => {
    expect(HOPS.length).toBe(11);
    expect(HOPS[0]!.name).toBe('Laptop');
    expect(HOPS[10]!.name).toBe('Web server');
    expect(new Set(HOPS.map((hop) => hop.name)).size).toBe(11);
    for (const hop of HOPS) {
      expect(hop.short.length).toBeLessThanOrEqual(hop.name.length);
      expect(hop.caption).toMatch(/^[A-Z].{20,}\.$/);
      expect(hop.does.length).toBeLessThanOrEqual(28);
    }
  });

  it('uses addresses reserved for examples, never a real one', () => {
    expect(DESTINATION_IP).toBe('198.51.100.7');
    expect(PORT).toBe(443);
    // 192.168.x.x is private; 203.0.113.x and 198.51.100.x are set aside for documentation.
    for (const hop of HOPS) expect(hop.ipSrc).toMatch(/^(192\.168\.|203\.0\.113\.)/);
    expect(HOPS.map((hop) => hop.caption).join(' ')).not.toMatch(/\b142\./);
  });

  it('loses one hop of life at each router, and only there', () => {
    expect(HOPS.map((hop) => hop.ttl)).toEqual([64, 63, 62, 62, 62, 62, 62, 61, 60, 60, 60]);
    expect(HOPS.map((hop) => hop.kind)).toEqual(['laptop', 'router', 'router', 'modem', 'amplifier', 'amplifier', 'modem', 'router', 'router', 'switch', 'server']);
    HOPS.forEach((hop, index) => {
      const lost = index > 0 && hop.ttl < HOPS[index - 1]!.ttl;
      expect(hop.kind === 'router', hop.name).toBe(lost);
    });
  });

  it('knows how deep each kind of device reads', () => {
    const depth = Object.fromEntries(HOPS.map((hop) => [hop.kind, hop.reads]));
    expect(depth).toEqual({ laptop: 4, router: 2, modem: 0, amplifier: 0, switch: 1, server: 4 });
  });

  it('names the three stretches, and where the fiber runs', () => {
    expect(ZONES).toEqual(['Home', 'Fiber, about 450 km', 'Data centre']);
    expect(HOPS.slice(FIBER.from, FIBER.to + 1).map((hop) => hop.kind)).toEqual(['modem', 'amplifier', 'amplifier', 'modem']);
  });
});

describe('changedFields', () => {
  it('is empty where the packet starts', () => {
    expect(changedFields(0)).toEqual([]);
  });

  it('is everything at the home router, which also swaps the source address', () => {
    expect(changedFields(1)).toEqual(['eDst', 'eSrc', 'ipSrc', 'ttl']);
  });

  it.each([2, 7, 8])('is the Ethernet header and the hop count at router %i', (step) => {
    expect(changedFields(step)).toEqual(['eDst', 'eSrc', 'ttl']);
  });

  it.each([3, 4, 5, 6, 9, 10])('is nothing at stop %i, which only carries or reads', (step) => {
    expect(changedFields(step)).toEqual([]);
  });

  it('is empty for a step that does not exist', () => {
    expect(changedFields(-1)).toEqual([]);
    expect(changedFields(11)).toEqual([]);
  });
});

describe('markFor: what a stop does with each layer', () => {
  const marks = (step: number) => LAYERS.map((layer) => markFor(step, layer));

  it('the laptop writes all four', () => {
    expect(marks(0)).toEqual(['written', 'written', 'written', 'written']);
  });

  it.each([1, 2, 7, 8])('router %i replaces Ethernet, edits IP and leaves the rest shut', (step) => {
    expect(marks(step)).toEqual(['rewritten', 'edited', 'none', 'none']);
  });

  it('never says a layer was only read at a stop that changed one of its values', () => {
    for (let step = 1; step <= 10; step += 1) {
      const changed = changedFields(step);
      if (changed.includes('eDst') || changed.includes('eSrc')) expect(markFor(step, 'eth'), `stop ${step}`).toBe('rewritten');
      if (changed.includes('ipSrc') || changed.includes('ttl')) expect(markFor(step, 'ip'), `stop ${step}`).toBe('edited');
      if (changed.length === 0) for (const layer of LAYERS) expect(['read', 'none'], `stop ${step}`).toContain(markFor(step, layer));
    }
  });

  it.each([3, 4, 5, 6])('stop %i on the fiber opens nothing', (step) => {
    expect(marks(step)).toEqual(['none', 'none', 'none', 'none']);
  });

  it('the switch reads Ethernet only, and the server reads everything', () => {
    expect(marks(9)).toEqual(['read', 'none', 'none', 'none']);
    expect(marks(10)).toEqual(['read', 'read', 'read', 'read']);
  });

  it('has words for every mark but "none", and a name and a note for every layer', () => {
    expect(MARK_TEXT).toEqual({ written: 'written here', rewritten: 'rewritten here', edited: 'edited here', read: 'read here', none: '' });
    for (const layer of LAYERS) {
      expect(LAYER_TEXT[layer].name.length).toBeGreaterThan(1);
      expect(LAYER_TEXT[layer].note).toMatch(/\.$/);
    }
  });
});

describe('stateAt', () => {
  it('gives every value on the wire at a stop', () => {
    expect(stateAt(1)).toEqual({ eDst: 'DD', eSrc: 'CC', ipSrc: '203.0.113.5', ttl: '63', ipDst: DESTINATION_IP, port: '443' });
  });

  it('stays inside the journey for a step outside it', () => {
    expect(stateAt(-3)).toEqual(stateAt(0));
    expect(stateAt(99)).toEqual(stateAt(10));
  });
});

describe('historyRows', () => {
  it('has one row per stop reached', () => {
    expect(historyRows(0).length).toBe(1);
    expect(historyRows(4).length).toBe(5);
    expect(historyRows(10).length).toBe(11);
  });

  it('carries each stop’s name, Ethernet addresses and hop count', () => {
    expect(historyRows(10).map((row) => row.ttl)).toEqual(HOPS.map((hop) => hop.ttl));
    expect(historyRows(2)[2]).toEqual({ stop: 'ISP router', eDst: 'EE', eSrc: 'DD', ttl: 62 });
    expect(historyRows(10)[10]!.stop).toBe('Web server');
  });
});

describe('the words around the packet', () => {
  it('say which stop the packet is at, counting from one', () => {
    expect(stepLine(0)).toBe('Stop 1 of 11 · Laptop');
    expect(stepLine(1)).toBe('Stop 2 of 11 · Home router');
    expect(stepLine(10)).toBe('Stop 11 of 11 · Web server');
    for (let step = 0; step <= 10; step += 1) expect(longestStepLine().length).toBeGreaterThanOrEqual(stepLine(step).length);
  });

  it('name the stop before and the stop after, and say so at the two ends', () => {
    expect(neighbours(0)).toEqual({ from: START, next: 'Home router' });
    expect(neighbours(4)).toEqual({ from: 'Optical modem (ISP end)', next: 'Amplifier 2' });
    expect(neighbours(10)).toEqual({ from: 'Data-centre switch', next: DELIVERED });
  });
});
