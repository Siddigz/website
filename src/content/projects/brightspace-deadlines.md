---
title: Brightspace Deadlines
oneLiner: A Chrome extension that pulls every deadline, grade and announcement from Carleton's Brightspace into one dashboard, applying each course outline's grading rules.
category: web-apps
stack: [JavaScript, Chrome Extension, GitHub API]
date: 2026-11
links:
  repo: https://github.com/Siddigz/brightspace-deadlines
featured: 3
result: Every deadline, grade and announcement across all courses in one dashboard, with each outline's grading rules applied.
cover: ../../assets/projects/brightspace-deadlines/cover.png
coverAlt: The Brightspace Deadlines grades page, showing a course average and the mark needed on the rest for each letter grade. Sample data.
gallery:
  - src: ../../assets/projects/brightspace-deadlines/deadlines.png
    alt: The deadlines page listing a week of quizzes, tests and assignments by day, colour-coded by course. Sample data.
---

## Problem

Deadlines, grades and announcements are scattered across separate course pages, and the gradebook ignores rules like "best 4 of 5" that each course outline sets.

## What I built

A Chrome extension that pulls everything into one dashboard using the session you are already signed in with, so it never sees a password. It applies each outline's grading rules to show a real average and what is needed for each letter grade. An optional read-only phone view syncs through the GitHub API.

## Result

One list for every quiz, assignment and test across all courses, including the ones the school's system does not know about.
