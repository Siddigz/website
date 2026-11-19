---
title: CPU Cache Benchmark
oneLiner: A C benchmark suite with a Python visualizer measuring cache behaviour, with automatic L1/L2/L3 detection.
category: systems
stack: [C, Python]
date: 2026-01
links:
  repo: https://github.com/Siddigz/CPU-Cache-Benchmark
featured: 6
result: Four benchmarks whose plots show access time rising at each cache boundary on a real CPU.
cover: ../../assets/projects/cpu-cache-benchmark/cover.png
coverAlt: Line chart of access time against array size. Sequential access stays flat while random access climbs after the L1 and L2 cache boundaries.
coverFit: contain
gallery:
  - src: ../../assets/projects/cpu-cache-benchmark/pointer-chasing.png
    alt: Line chart of pointer-chasing access time against data size, rising sharply after the L1 and L2 cache boundaries.
  - src: ../../assets/projects/cpu-cache-benchmark/stride.png
    alt: Line chart of access time against stride, rising as the stride grows and neighbouring reads stop sharing a cache line.
  - src: ../../assets/projects/cpu-cache-benchmark/aos-soa.png
    alt: Chart comparing array-of-structs and struct-of-arrays layouts across data sizes.
---

## Problem

"Cache-friendly code is faster" is easy to repeat and hard to picture. I wanted to measure it on real hardware.

## What I built

A benchmark suite in C with four tests: sequential versus random access, stride access, array-of-structs versus struct-of-arrays, and pointer chasing. A Python visualizer detects the CPU and its L1, L2 and L3 sizes and marks those boundaries on the plots. It runs on Linux, macOS and Windows.

## Result

Plots that show random access slowing down as the data outgrows each cache level, while sequential access stays flat.
