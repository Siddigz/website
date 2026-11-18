---
title: alternative-signals
oneLiner: A backtesting pipeline testing whether 7 free data signals predict company results and stock returns.
category: ai-data
stack: [Python, BERT, SEC EDGAR, Google Trends]
date: 2026-11
links:
  repo: https://github.com/Siddigz/alternative-signals
featured: 2
result: Tested 7 signals across 40 companies, 261,000+ reviews and 3.0 million insider trades. One held up.
cover: ../../assets/projects/alternative-signals/cover.png
coverAlt: Bar chart of how well seven free signals predict sales surprises and stock returns across 40 companies. Google search has the longest bar.
---

## Problem

A published study claims the tone of online product reviews predicts earnings surprises. I wanted to know whether that, or any other free data source, actually holds up.

## What I built

A Python backtesting pipeline that tests seven signals across 40 companies: 261,000+ Amazon reviews scored by a local BERT model, Wikipedia and Google search interest, filing wording, 3.0 million insider trades from SEC filings, and short interest. Every result is corrected for multiple testing and checked out of sample.

## Result

Google search interest is the one signal that holds up. Review tone, the idea the project started from, predicts nothing.
