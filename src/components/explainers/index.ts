// The interactive part of each explainer, by the name of its content file.
// A content file with no entry here stops the build (see src/pages/explainers/[slug].astro).
import PacketHops from './PacketHops.astro';
import SignalLevels from './SignalLevels.astro';

export const WIDGETS: Record<string, typeof PacketHops> = {
  'one-packet-hop-by-hop': PacketHops,
  'nrz-vs-pam4': SignalLevels,
};
