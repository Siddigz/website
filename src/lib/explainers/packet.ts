/*
 * "Follow a packet across the internet": the journey of one web request, what
 * each device on the way reads, and which values it rewrites. Pure data and
 * logic, shared by the page as built, the page script and the tests.
 *
 * Every address is from a range set aside for examples, and no device is
 * named after a company.
 */
export type Field = 'eDst' | 'eSrc' | 'ipSrc' | 'ttl';
export type Kind = 'laptop' | 'router' | 'modem' | 'amplifier' | 'switch' | 'server';
/** The packet's four layers, from the outside in. */
export type Layer = 'eth' | 'ip' | 'tcp' | 'data';
export const LAYERS: readonly Layer[] = ['eth', 'ip', 'tcp', 'data'];

export type Hop = {
  name: string;
  /** A shorter name, for the table of the whole journey. */
  short: string;
  /** What sort of device it is: picks its drawing. */
  kind: Kind;
  /** What it does to the packet, in a few words. */
  does: string;
  /** How many layers it opens, counted from the outside: 0 none, 1 Ethernet, 2 also IP, 4 everything. */
  reads: 0 | 1 | 2 | 4;
  caption: string;
  /** What is on the wire as the packet leaves this stop. */
  eDst: string;
  eSrc: string;
  ipSrc: string;
  ttl: number;
};

export const DESTINATION_IP = '198.51.100.7';
export const PORT = 443;
const PRIVATE_IP = '192.168.1.10';
const PUBLIC_IP = '203.0.113.5';
const ROUTER = { kind: 'router', does: 'Reads IP, rewrites Ethernet', reads: 2 } as const;

export const HOPS: readonly Hop[] = [
  {
    name: 'Laptop',
    short: 'Laptop',
    kind: 'laptop',
    does: 'Builds the packet',
    reads: 4,
    caption: `Your laptop wraps the web request in four layers. The outer one, Ethernet, is addressed only as far as the home router (MAC BB). The IP layer is addressed all the way to the web server, ${DESTINATION_IP}.`,
    eDst: 'BB',
    eSrc: 'AA',
    ipSrc: PRIVATE_IP,
    ttl: 64,
  },
  {
    name: 'Home router',
    short: 'Home router',
    ...ROUTER,
    caption: `The router throws away the old Ethernet layer and writes a new one for the next link. It also swaps your private address for the public ${PUBLIC_IP} (this is NAT), and uses up one hop.`,
    eDst: 'DD',
    eSrc: 'CC',
    ipSrc: PUBLIC_IP,
    ttl: 63,
  },
  {
    name: 'ISP router',
    short: 'ISP router',
    ...ROUTER,
    caption: 'A new Ethernet layer again, addressed to the carrier router (MAC EE). One more hop used. The IP destination has not changed.',
    eDst: 'EE',
    eSrc: 'DD',
    ipSrc: PUBLIC_IP,
    ttl: 62,
  },
  {
    name: 'Optical modem (ISP end)',
    short: 'Modem (ISP end)',
    kind: 'modem',
    does: 'Turns bits into light',
    reads: 0,
    caption: 'The modem turns the bits into light. It reads nothing and changes nothing.',
    eDst: 'EE',
    eSrc: 'DD',
    ipSrc: PUBLIC_IP,
    ttl: 62,
  },
  {
    name: 'Amplifier 1',
    short: 'Amplifier 1',
    kind: 'amplifier',
    does: 'Boosts the light',
    reads: 0,
    caption: 'An amplifier makes the light stronger. It does not even know there are bits in it.',
    eDst: 'EE',
    eSrc: 'DD',
    ipSrc: PUBLIC_IP,
    ttl: 62,
  },
  {
    name: 'Amplifier 2',
    short: 'Amplifier 2',
    kind: 'amplifier',
    does: 'Boosts the light',
    reads: 0,
    caption: 'Another amplifier, further along the fiber. Still nothing is read or changed.',
    eDst: 'EE',
    eSrc: 'DD',
    ipSrc: PUBLIC_IP,
    ttl: 62,
  },
  {
    name: 'Optical modem (carrier end)',
    short: 'Modem (carrier end)',
    kind: 'modem',
    does: 'Turns light back into bits',
    reads: 0,
    caption: 'The far modem turns the light back into bits. The packet is exactly as the ISP router sent it.',
    eDst: 'EE',
    eSrc: 'DD',
    ipSrc: PUBLIC_IP,
    ttl: 62,
  },
  {
    name: 'Carrier router',
    short: 'Carrier router',
    ...ROUTER,
    caption: 'A new Ethernet layer, addressed to the edge router (MAC FF). One more hop used.',
    eDst: 'FF',
    eSrc: 'EE',
    ipSrc: PUBLIC_IP,
    ttl: 61,
  },
  {
    name: 'Edge router',
    short: 'Edge router',
    ...ROUTER,
    caption: 'The server is on this router’s own network, so the new Ethernet layer is addressed to the server itself (MAC 99). One more hop used.',
    eDst: '99',
    eSrc: 'FF',
    ipSrc: PUBLIC_IP,
    ttl: 60,
  },
  {
    name: 'Data-centre switch',
    short: 'Switch',
    kind: 'switch',
    does: 'Reads Ethernet only',
    reads: 1,
    caption: 'The switch looks at the Ethernet address, picks the cable that leads to MAC 99, and changes nothing.',
    eDst: '99',
    eSrc: 'FF',
    ipSrc: PUBLIC_IP,
    ttl: 60,
  },
  {
    name: 'Web server',
    short: 'Web server',
    kind: 'server',
    does: 'Unwraps every layer',
    reads: 4,
    caption: `Ethernet says MAC 99: that is me. IP says ${DESTINATION_IP}: that is me. TCP says port ${PORT}, so the request goes to the web server program.`,
    eDst: '99',
    eSrc: 'FF',
    ipSrc: PUBLIC_IP,
    ttl: 60,
  },
];

export const LAST_STEP = HOPS.length - 1;

/** The row of stops, named for screen readers. */
export const ROUTE_LABEL = 'The stops from the laptop to the web server';
/** The three stretches of the journey, written under the row of stops. */
export const ZONES = ['Home', 'Fiber, about 250 km', 'Data centre'] as const;
/** The stops joined by the long fiber: the line between them is drawn as light. */
export const FIBER = { from: 3, to: 6 } as const;

/** Each layer's name, and one line on how it behaves over the whole journey. */
export const LAYER_TEXT: Record<Layer, { name: string; note: string }> = {
  eth: { name: 'Ethernet', note: 'Only reaches the next device. Every router writes a new one.' },
  ip: { name: 'IP', note: 'The destination never changes. Each router uses up one hop.' },
  tcp: { name: 'TCP', note: `${PORT} means HTTPS.` },
  data: { name: 'Data', note: 'No device on the way touches it.' },
};

/** What a stop does with a layer: writes it, replaces it whole, changes a value in it, only reads it, or leaves it shut. */
export type Mark = 'written' | 'rewritten' | 'edited' | 'read' | 'none';
export const MARK_TEXT: Record<Mark, string> = { written: 'written here', rewritten: 'rewritten here', edited: 'edited here', read: 'read here', none: '' };
/** How deep into the packet a layer sits: a device that reads this many layers reaches it. */
const DEPTH: Record<Layer, number> = { eth: 1, ip: 2, tcp: 4, data: 4 };

const FIELDS: Field[] = ['eDst', 'eSrc', 'ipSrc', 'ttl'];
const clamp = (step: number) => Math.min(LAST_STEP, Math.max(0, Math.trunc(step) || 0));

/** The values that differ from the stop before. Empty at the start and for a step outside the journey. */
export function changedFields(step: number): Field[] {
  const here = HOPS[step];
  const before = HOPS[step - 1];
  if (!here || !before) return [];
  return FIELDS.filter((field) => here[field] !== before[field]);
}

/**
 * What the stop does with one layer: writes it (the laptop), replaces it (a router and Ethernet), changes a
 * value inside it (a router and IP: one hop fewer, and at home a new source address), reads it, or leaves it shut.
 * It follows the values themselves, so the mark can never disagree with what is shown as changed.
 */
export function markFor(step: number, layer: Layer): Mark {
  const at = clamp(step);
  if (at === 0) return 'written';
  const changed = changedFields(at);
  if (layer === 'eth' && (changed.includes('eDst') || changed.includes('eSrc'))) return 'rewritten';
  if (layer === 'ip' && (changed.includes('ipSrc') || changed.includes('ttl'))) return 'edited';
  return HOPS[at]!.reads >= DEPTH[layer] ? 'read' : 'none';
}

/** Every value shown for a stop, as text. A step outside the journey gives the nearest end. */
export function stateAt(step: number): Record<Field | 'ipDst' | 'port', string> {
  const hop = HOPS[clamp(step)]!;
  return { eDst: hop.eDst, eSrc: hop.eSrc, ipSrc: hop.ipSrc, ttl: String(hop.ttl), ipDst: DESTINATION_IP, port: String(PORT) };
}

/** One row per stop reached so far: the stop, and the values that change along the way as the packet leaves it. */
export function historyRows(step: number): { stop: string; eDst: string; eSrc: string; ttl: number }[] {
  return HOPS.slice(0, clamp(step) + 1).map((hop) => ({ stop: hop.short, eDst: hop.eDst, eSrc: hop.eSrc, ttl: hop.ttl }));
}

/** "Stop 4 of 11 · Optical modem (ISP end)" */
export function stepLine(step: number): string {
  const at = clamp(step);
  return `Stop ${at + 1} of ${HOPS.length} · ${HOPS[at]!.name}`;
}

/** The longest of those lines: the page keeps room for it, so nothing jumps between stops. */
export function longestStepLine(): string {
  return HOPS.map((_, step) => stepLine(step)).reduce((longest, line) => (line.length > longest.length ? line : longest));
}

/** The stop before and the stop after, by name. The ends of the journey say so instead. */
export function neighbours(step: number): { from: string; next: string } {
  const at = clamp(step);
  return { from: HOPS[at - 1]?.name ?? START, next: HOPS[at + 1]?.name ?? DELIVERED };
}

/** Shown where the stop before would be, at the first stop. */
export const START = 'Start';
/** Shown where the next stop would be, once the packet has arrived. */
export const DELIVERED = 'Delivered';
