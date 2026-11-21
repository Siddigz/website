import { describe, it, expect } from 'vitest';
import { DESTINATION_IP, HOPS, PORT, ROUTE_LABEL, STRETCHES, changeLine, changedFields, historyRows, longestStepLine, stateAt, stepLine, stretchOf } from '../../src/lib/explainers/packet';

describe('the packet’s journey', () => {
  it('has eleven stops, from the laptop to the web server', () => {
    expect(HOPS.length).toBe(11);
    expect(HOPS[0]!.name).toBe('Laptop');
    expect(HOPS[10]!.name).toBe('Web server');
    for (const hop of HOPS) {
      expect(hop.short.length).toBeLessThanOrEqual(hop.name.length);
      expect(hop.caption.length).toBeGreaterThan(20);
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

describe('stateAt', () => {
  it('gives every header value on the wire at a stop', () => {
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

  it('names each link by the stops at its two ends, and the last row as the delivery', () => {
    const rows = historyRows(10);
    expect(rows[0]!.link).toBe('Laptop → Home router');
    expect(rows[10]!.link.startsWith('Delivered at')).toBe(true);
    for (const row of rows.slice(0, 10)) expect(row.link).toContain(' → ');
  });

  it('shows the same destination on every row: it never changes end to end', () => {
    for (const row of historyRows(10)) expect(row.ipDst).toBe(DESTINATION_IP);
  });

  it('carries each stop’s Ethernet addresses and hop count', () => {
    expect(historyRows(10).map((row) => row.ttl)).toEqual(HOPS.map((hop) => hop.ttl));
    expect(historyRows(2)[2]).toEqual({ link: 'ISP router → Modem (ISP end)', eDst: 'EE', eSrc: 'DD', ipDst: DESTINATION_IP, ttl: 62 });
  });
});

describe('the lines of text under the drawing', () => {
  it('say which stop the packet is at', () => {
    expect(stepLine(0)).toBe('Step 0 of 10 · now at: Laptop');
    expect(stepLine(1)).toBe('Step 1 of 10 · now at: Home router');
    expect(stepLine(10)).toBe('Step 10 of 10 · now at: Web server');
  });

  it('say what changed there, in words', () => {
    expect(changeLine(0)).toBe('The packet was just created on the laptop.');
    expect(changeLine(1)).toBe('Changed at this step: Ethernet dst MAC, Ethernet src MAC, IP src, TTL.');
    expect(changeLine(2)).toBe('Changed at this step: Ethernet dst MAC, Ethernet src MAC, TTL.');
    expect(changeLine(4)).toBe('Nothing in the packet changed at this step.');
  });
});

describe('the route as drawn', () => {
  it('gives every stop a kind of device, and routers are exactly where a hop of life is lost', () => {
    expect(HOPS.map((hop) => hop.kind)).toEqual(['laptop', 'router', 'router', 'modem', 'amplifier', 'amplifier', 'modem', 'router', 'router', 'switch', 'server']);
    HOPS.forEach((hop, index) => {
      const lost = index > 0 && hop.ttl < HOPS[index - 1]!.ttl;
      expect(hop.kind === 'router', hop.name).toBe(lost);
    });
  });

  it('says under each end of the journey which addresses it has', () => {
    expect(HOPS[0]!.detail).toEqual(['MAC AA', 'IP 192.168.1.10']);
    expect(HOPS[10]!.detail).toEqual(['MAC 99', `IP ${DESTINATION_IP}`]);
    // Every router is named by its MAC address, which is what the Ethernet header points at.
    for (const hop of HOPS.filter((each) => each.kind === 'router')) expect(hop.detail.join(' ')).toContain('MAC');
    for (const hop of HOPS) for (const line of hop.detail) expect(line.length).toBeLessThanOrEqual(24);
  });

  it('groups the stops into the two local networks and the long fiber between them', () => {
    expect(STRETCHES.map((stretch) => [stretch.tone, stretch.from, stretch.to])).toEqual([
      ['home', 0, 1],
      ['fiber', 3, 6],
      ['dc', 8, 10],
    ]);
    for (const stretch of STRETCHES) expect(stretch.label.length).toBeGreaterThan(3);
    expect(stretchOf(0)?.tone).toBe('home');
    expect(stretchOf(4)?.tone).toBe('fiber');
    expect(stretchOf(10)?.tone).toBe('dc');
    // The two routers at the ends of the fiber link stand between networks.
    expect(stretchOf(2)).toBeUndefined();
    expect(stretchOf(7)).toBeUndefined();
    expect(stretchOf(11)).toBeUndefined();
  });

  it('has a name for the whole route, and knows its longest step line', () => {
    expect(ROUTE_LABEL.length).toBeGreaterThan(10);
    const longest = longestStepLine();
    for (let step = 0; step <= 10; step += 1) expect(longest.length).toBeGreaterThanOrEqual(stepLine(step).length);
    expect(longest).toBe(stepLine(6));
  });
});
