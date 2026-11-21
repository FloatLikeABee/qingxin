# 潮汐呼吸 (approved 2026-11-21)

Ge approved: **Build all three as designed, with fancy Three.js visuals and real gameplay.** This is 潮汐呼吸 only as the first independently deliverable game. **Luminous night ocean; hold/release builds breathing waves; guide glowing sea creatures; collect scattered starlight; unlock coral gardens without a timer.**

Workstream: same PR 37 / `cursor/shangban-stage1-4e4e`. Do not merge, deploy, or Mac-edit. Parent auto-syncs verified commits. 云上散步 and 记忆货架 stay honest catalog placeholders until their own follow-ups.

This is a **catalog game**. Not a shell upgrade, not 上班, not medical software.

## Player fantasy

A night ocean that actually lives. Moonlight on water. Hold and the sea swells; release and a luminous pulse rolls out. Glowing jellyfish, lantern fish, and a manta drift with the current. You guide one toward scattered starlight. Enough starlight wakes a coral garden on the seabed. No clock, no high score, no fail for breathing “wrong.”

If the scene is a flat plane plus three primitive spheres, this failed. If hold/release does not visibly change the ocean, this failed. If coral unlock is only a UI badge with no 3D garden, this failed. If a timer or forced breath-hold appears, this failed.

## What exists today (inspect)

| Layer | Live behavior |
| --- | --- |
| Catalog | `tide-breath` status `coming`, CTA 即将到来, about “节奏还没写进拍号” |
| Play route | `entries` only emit `playable` games; coming ids redirect to detail |
| Play skip | `isPlayView` matches `/play/?$` so `/modules/games/tide-breath/play` already unmounts nebula |
| Three.js | `three` ^0.187 already used by store/garden/shooter/上班/积木台 |
| Pattern | Sim in `sim.ts` + persist + `*Play.svelte` chrome-glass + lazy `render.ts` |

## Approved loop

1. Guest opens `/modules/games/tide-breath` → 开始入海 → full-viewport night sea (no AppShell nebula/topbar).
2. Onboarding copy in the glass dock: **按住随潮升起，松开送出波纹。点海面或用方向键引导发光的海物去捡星光。不必憋气。** Optional 4s/6s pace ring is a cue only — never a fail, never a medical claim.
3. Hold (pointer down on sea, Space, or 潮汐 button) raises `swell` 0→1. Release drops swell and emits an `exhalePulse` that visibly travels.
4. One creature is selected (click / tap / Tab). Holding also steers it toward the pointer hit on the water, or arrow keys steer. Creatures are distinct meshes (jelly bell+tentacles, lantern body+glow, manta wings), not identical spheres.
5. Starlight orbs on the water. Collect when the guided creature is close. First orb is near the starting jelly so a guest (and Playwright) can collect without cheats.
6. Coral gardens unlock at **1 / 3 / 6** collected starlights. Unlock grows actual branching coral + anemone meshes and lights them. Six starlights total.
7. No session timer. Pause freezes sim+audio. Hidden tab pauses. Reload keeps collected stars, unlocked coral, settings.

## Controls and chrome

- `← 返回目录`, large uncluttered stage, collapsible glass dock (`收起操作` / `展开操作`).
- Stats: 星光 n/6, 珊瑚 n/3. Notice `aria-live`.
- 暂停 / 继续, 低细腻, 海声 (opt-in) / 静音.
- Keyboard: Space hold/release, arrows steer, `[` `]` cycle creatures, `P` pause.
- Pointer/touch: press-and-hold on the sea; tap a creature to select.
- Reduced motion: calmer displacement, fewer particles, no tentacle thrash; ocean still looks like a night sea, not a blank fill.
- Low-detail: lower water segments, no shadows, particle cap ~80, DPR 1 on narrow.
- Audio: Web Audio after the 海声 gesture only. No autoplay. Stop on mute/pause/hidden/unmount. Soft noise + collect chime.
- WebGL failure: still simulate; show 这台设备画不出夜海。按住仍可感受潮汐起伏。

## Visual bar (mandatory Three.js, not a placeholder)

Night cinematic lighting: ACES, fog, moon directional + cool hemisphere + bioluminescent point lights. Shader water (Gerstner-like vertex displacement driven by swell/pulse, foam at crests, fake moon specular). Sky dome + calm star points + moon disc. Plankton/foam particles. Coral is geometry, not a sprite billboard. Tone is Qingxin blue/teal/gold, not medical green.

## Persist

Key `qingxin.games.tide-breath`, schema 1. Fields: collected star ids, unlocked coral ids, selected creature, `lowDetail`, `audioWanted` (never starts playback by itself), `dockCollapsed`. Corrupt save → recovered ocean, notice, no wipe of other Qingxin keys. Never write `qingxin.theme`.

## Preserve

Chrome-glass elsewhere, nebula on non-play routes, existing games/saves, guest play, no auth/backend, zh-CN. No paid assets/npm. Procedural only.

## Verification

Genuine Playwright guest play (privacy consent only; **no** seeded completed save and **no** engine tick injection as the only evidence): hold/release changes `data-swell` / visible water; guide + collect increments `data-stars`; coral `data-coral` ≥ 1 with 3D garden visible; reload persists; pause / reduced-motion / low-detail / 海声; 390 and 1280; other game smokes still pass. Screenshots + gameplay webm.

## Out of scope this game

云上散步, 记忆货架, medical advice, accounts, merge/deploy/Mac.
