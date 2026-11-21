# 潮汐呼吸 marine + night sky (approved t275u 2026-11-21)

**Approved to implement.** Celestial sky vs marine water stay two layers. Coral thresholds **1 / 3 / 6**, six pickup **ids**, save key/schema unchanged. Player copy **海光**. Catalog **card art stays**.

## Scene

- Camera shows a real sky band (~30%): `(0, 5.2, 12.8)` lookAt `(0, 1.4, -1.8)`. Moon in that band.
- Sky: near-black zenith, navy horizon. Dense hemisphere stars (~900 / ~400 low-detail). **Four** line constellations 水母、灯鱼、蝠鲼、螺. Low-detail **keeps** stars + lines (do not hide the sky).
- Six distinct bioluminescent pickups (ids 0–5, same positions): 水母光, 灯笼, 月光水母盘, 浮游团, 夜光贝, 海草穗. Not icosahedron clones.
- Seabed always has seaweed/shells/rubble. Coral gardens still grow at 1/3/6.
- HUD **海光 n/6**. Notices `捡到海光`. Sky clicks do not collect.

## Preserve

Swell/pulse, creatures, collect radius, pause/hidden, 海声 gesture-only, reduced-motion still a night sea, 390/1280, `data-stars` dataset, `qingxin.games.tide-breath` schema 1.
