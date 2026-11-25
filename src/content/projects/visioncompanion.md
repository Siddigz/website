---
title: VisionCompanion
oneLiner: An iPhone worn on a chest strap that spots street hazards for a blind walker and announces them out loud.
category: ai-data
stack: [TypeScript, Python, Gemini, ElevenLabs]
date: 2026-09
links:
  repo: https://github.com/Siddigz/VisionCompanion
  live: https://visioncompanion.vercel.app
  video: https://www.youtube.com/watch?v=HKM--zb6ZgE
featured: 4
result: A live app built at Hack the Hill III that speaks hazards in English and French.
cover: ../../assets/projects/visioncompanion/cover.jpg
coverAlt: The VisionCompanion hazard map of downtown Ottawa, with coloured markers for potholes, uneven pavement and crossings.
gallery:
  - src: ../../assets/projects/visioncompanion/phone-near-me.jpg
    alt: The VisionCompanion start screen on a phone, with setup steps, a nearby-potholes summary and a Start walk button.
  - src: ../../assets/projects/visioncompanion/phone-map.jpg
    alt: The hazard map on a phone, with markers along the streets and a Pin here button.
  - src: ../../assets/projects/visioncompanion/signal-path-3d.png
    alt: Diagram of the signal path. The camera takes a photo, Gemini sees the hazards, the app picks what matters, ElevenLabs turns it into a voice, and the walker hears it in headphones.
---

## Problem

A white cane finds what is on the ground directly ahead. It cannot warn about a low branch, a construction zone or a pothole a few steps away.

## What I built

Built at Hack the Hill III. A phone worn on a chest strap sends its camera view to Gemini, which spots hazards, and ElevenLabs speaks short alerts with a tone for direction. Walkers can ask questions by voice in English or French, and a hazard map adds reports from other walkers and Ottawa's open 311 data.

## Result

A live app anyone can open on an iPhone. It adds information a cane cannot give, and says so when it cannot see clearly.
