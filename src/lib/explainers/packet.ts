/*
 * "One packet, hop by hop": the journey of one web request, and which header
 * values each device on the way rewrites. Pure data and logic, shared by the
 * page as built, the page script and the tests.
 *
 * Every address is from a range set aside for examples, and no device is
 * named after a company.
 */
export type Field = 'eDst' | 'eSrc' | 'ipSrc' | 'ttl';
export type Hop = {
  name: string;
  /** A shorter name, for the history table. */
  short: string;
  caption: string;
  /** What is on the wire as the packet leaves this stop. */
  eDst: string;
  eSrc: string;
  ipSrc: string;
  ttl: number;
};

export const DESTINATION_IP = '198.51.100.7';
export const PORT = 443;
const PUBLIC_IP = '203.0.113.5';

export const HOPS: readonly Hop[] = [
  {
    name: 'Laptop',
    short: 'Laptop',
    caption: `Leaving the laptop. Ethernet is addressed to the home router (MAC BB). IP is addressed to the web server, ${DESTINATION_IP}, and that will not change end to end.`,
    eDst: 'BB',
    eSrc: 'AA',
    ipSrc: '192.168.1.10',
    ttl: 64,
  },
  {
    name: 'Home router',
    short: 'Home router',
    caption: `Home router: peels off the old Ethernet header and attaches a new one for the ISP link. NAT swaps your private source IP for public ${PUBLIC_IP}. TTL drops to 63.`,
    eDst: 'DD',
    eSrc: 'CC',
    ipSrc: PUBLIC_IP,
    ttl: 63,
  },
  {
    name: 'ISP router',
    short: 'ISP router',
    caption: 'ISP router: a brand-new Ethernet header addressed to the carrier router (MAC EE). TTL drops to 62. The IP destination is still the web server.',
    eDst: 'EE',
    eSrc: 'DD',
    ipSrc: PUBLIC_IP,
    ttl: 62,
  },
  {
    name: 'Optical modem (ISP end)',
    short: 'Modem (ISP end)',
    caption: 'Modem: carries the bits, reads nothing, changes nothing.',
    eDst: 'EE',
    eSrc: 'DD',
    ipSrc: PUBLIC_IP,
    ttl: 62,
  },
  {
    name: 'Amplifier 1',
    short: 'Amp 1',
    caption: 'Amplifier: boosts the light, doesn’t even decode bits.',
    eDst: 'EE',
    eSrc: 'DD',
    ipSrc: PUBLIC_IP,
    ttl: 62,
  },
  {
    name: 'Amplifier 2',
    short: 'Amp 2',
    caption: 'Amplifier: boosts the light, doesn’t even decode bits.',
    eDst: 'EE',
    eSrc: 'DD',
    ipSrc: PUBLIC_IP,
    ttl: 62,
  },
  {
    name: 'Optical modem (carrier end)',
    short: 'Modem (carrier end)',
    caption: 'Modem: carries the bits, reads nothing, changes nothing.',
    eDst: 'EE',
    eSrc: 'DD',
    ipSrc: PUBLIC_IP,
    ttl: 62,
  },
  {
    name: 'Carrier router',
    short: 'Carrier router',
    caption: 'Carrier router: new Ethernet header addressed to the edge router (MAC FF). TTL drops to 61.',
    eDst: 'FF',
    eSrc: 'EE',
    ipSrc: PUBLIC_IP,
    ttl: 61,
  },
  {
    name: 'Edge router',
    short: 'Edge router',
    caption: 'Edge router: new Ethernet header addressed to the server itself (MAC 99), because the server is on this router’s local network. TTL drops to 60.',
    eDst: '99',
    eSrc: 'FF',
    ipSrc: PUBLIC_IP,
    ttl: 60,
  },
  {
    name: 'Data-centre switch',
    short: 'DC switch',
    caption: 'Switch: reads dst MAC 99, picks the port that leads to that device, changes nothing.',
    eDst: '99',
    eSrc: 'FF',
    ipSrc: PUBLIC_IP,
    ttl: 60,
  },
  {
    name: 'Web server',
    short: 'Web server',
    caption: `Server: peels every layer. Ethernet MAC 99 = me, accept. IP ${DESTINATION_IP} = me. TCP port ${PORT} → hand the data to the web server program.`,
    eDst: '99',
    eSrc: 'FF',
    ipSrc: PUBLIC_IP,
    ttl: 60,
  },
];

export const LAST_STEP = HOPS.length - 1;
/** What the server concludes when the packet arrives. */
export const VERDICT = `Ethernet: dst MAC 99 = this server → accept the frame. IP: dst ${DESTINATION_IP} = this server → accept the packet. TCP: port ${PORT} → pass the data up to the web server program.`;
export const FIELD_LABELS: Record<Field, string> = { eDst: 'Ethernet dst MAC', eSrc: 'Ethernet src MAC', ipSrc: 'IP src', ttl: 'TTL' };
/** The stops where a router replaces the Ethernet header (and, at the last one, where the server removes it). */
export const NEW_HEADER_AT: readonly number[] = [1, 2, 7, 8, 10];

const FIELDS: Field[] = ['eDst', 'eSrc', 'ipSrc', 'ttl'];
const clamp = (step: number) => Math.min(LAST_STEP, Math.max(0, Math.trunc(step) || 0));

/** The header values that differ from the stop before. Empty at the start and for a step outside the journey. */
export function changedFields(step: number): Field[] {
  const here = HOPS[step];
  const before = HOPS[step - 1];
  if (!here || !before) return [];
  return FIELDS.filter((field) => here[field] !== before[field]);
}

/** Every value shown for a stop, as text. A step outside the journey gives the nearest end. */
export function stateAt(step: number): Record<Field | 'ipDst' | 'port', string> {
  const hop = HOPS[clamp(step)]!;
  return { eDst: hop.eDst, eSrc: hop.eSrc, ipSrc: hop.ipSrc, ttl: String(hop.ttl), ipDst: DESTINATION_IP, port: String(PORT) };
}

/** One row per stop reached so far: the link the packet leaves on, and what its headers say there. */
export function historyRows(step: number): { link: string; eDst: string; eSrc: string; ipDst: string; ttl: number }[] {
  return HOPS.slice(0, clamp(step) + 1).map((hop, index) => {
    const next = HOPS[index + 1];
    return {
      link: next ? `${hop.short} → ${next.short}` : `Delivered at ${hop.short}`,
      eDst: hop.eDst,
      eSrc: hop.eSrc,
      ipDst: DESTINATION_IP,
      ttl: hop.ttl,
    };
  });
}

/** "Step 3 of 10 · now at: Optical modem (ISP end)" */
export function stepLine(step: number): string {
  const at = clamp(step);
  return `Step ${at} of ${LAST_STEP} · now at: ${HOPS[at]!.name}`;
}

/** What changed at a stop, as a sentence. */
export function changeLine(step: number): string {
  if (clamp(step) === 0) return 'The packet was just created on the laptop.';
  const changed = changedFields(clamp(step));
  if (changed.length === 0) return 'Nothing in the packet changed at this step.';
  return `Changed at this step: ${changed.map((field) => FIELD_LABELS[field]).join(', ')}.`;
}

/** Shown beside the buttons once the packet has arrived. */
export const DELIVERED = 'Packet delivered.';
