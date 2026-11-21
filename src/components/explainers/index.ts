// The interactive part of each explainer, by the name of its content file.
// A content file with no entry here stops the build (see src/pages/explainers/[slug].astro).
import PacketHops from './PacketHops.astro';
import PacketThumb from './PacketThumb.astro';
import SignalLevels from './SignalLevels.astro';
import SignalThumb from './SignalThumb.astro';

export const WIDGETS: Record<string, typeof PacketHops> = {
  'one-packet-hop-by-hop': PacketHops,
  'nrz-vs-pam4': SignalLevels,
};

// The small still drawing on each explainer's card on the home page.
export const THUMBS: Record<string, typeof PacketThumb> = {
  'one-packet-hop-by-hop': PacketThumb,
  'nrz-vs-pam4': SignalThumb,
};
