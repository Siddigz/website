---
title: cuRiding
oneLiner: An e-scooter safety system. A Raspberry Pi 5 dashcam detects cars, pedestrians and red lights in real time, and a server streams telemetry and raises crash alerts.
category: ai-data
stack: [C++, QNX, TensorFlow Lite, OpenCV, FastAPI, WebSockets, React Native]
date: 2026-07
links:
  repo: https://github.com/Siddigz/cuRiding-pi
  extraRepos:
    - https://github.com/Siddigz/cuRiding-Server
  video: https://www.youtube.com/shorts/Ubc34F7nnvk
  post: https://www.linkedin.com/feed/update/urn:li:activity:7484996503888101377/
featured: 1
result: Won People’s Choice at cuHacking 7.
award:
  name: People’s Choice
  event: cuHacking 7
cover: ../../assets/projects/curiding/cover.jpg
coverAlt: A hand holding a small camera wired to a Raspberry Pi, with a laptop behind it showing the live camera view.
coverPosition: center
gallery:
  - src: ../../assets/projects/curiding/team.jpg
    alt: Four teammates around a table of laptops and electronics parts, smiling at the camera.
  - src: ../../assets/projects/curiding/award.jpg
    alt: The team on stage holding their prize backpacks beside the event organisers.
---

## Problem

E-scooter riders share the road with cars but have none of a car's warning systems, and after a crash a rider may have no way to call for help.

## What I built

Built with a team at cuHacking 7. A dashcam on a Raspberry Pi 5 running QNX 8 detects cars, pedestrians and red lights in real time with TensorFlow Lite and OpenCV, and warns the rider. A FastAPI server streams telemetry once a second over WebSockets to a React Native app, and raises a crash alert when the heartbeats stop mid-ride.

## Result

Won People's Choice at cuHacking 7.
