# 云上散步 screen-left / screen-right fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. No subagent fanout.

**Goal:** A / ArrowLeft move **screen-left**, D / ArrowRight move **screen-right**, and pointer fly-to aims at the visible point, for chase headings in sky and underwater. Keep cannon, free flight, focus/blur release, dive, save pose. Do not edit truck.

**Root cause (evidence, not labels):** Chase `follow()` sits at `walker - (sin yaw, cos yaw)` and `lookAt` the ghost, so yaw 0 looks along world **+Z**. Three.js `lookAt` camera +X (screen-right) is then world **−X**. `wish()` used `right = (cos yaw, −sin yaw)` = **+X** at yaw 0 — the opposite of screen-right. Commit `f133899` locked that with a world-axis test (`D` ⇒ `x > 2`) instead of frozen-cam NDC.

**Fix:** `skyRight(yaw) = (−cos yaw, sin yaw)`; strafe along that vector. Touch already uses the camera ray (`flyAimAlongRay`); assert steer toward a screen-left point decreases frozen NDC x. Do not flip W/+Z look.

**Stack:** Branch `cursor/cloud-left-right-4e4e` from `aeb766a` (PR #50). Shelf WIP stays on `cursor/shelf-more-haunts-4e4e` (`ab7b30b`), not this PR.

## Self-review

| Need | Plan |
| --- | --- |
| Signed projected motion, not abs / world-X labels | Frozen chase cam; D raises NDC x |
| A/D, arrows, diagonals, water | Same helper, several yaws + wet chaseOffset |
| Focus release | Existing releaseSkyControls + e2e blur |
| 390 tap left/right | Ray point on that side; fly toward it |
| Truck untouched | No cargo edits |
| Annual Report 5s sales | Docs follow-up only; no report code |
