# 手术 — cut then sew only (t278u)

**Approved to implement** (Ge t278u `'approved'` 2026-11-22 14:21 Asia/Shanghai). Supersedes t275u five-phase tool lists. Catalog id `operation`, route, lane **R**, four regions, and warning gate stay.

**Status:** written spec for review. No app code in this commit. GPU frame time has **not** been measured.

## Player fantasy

Pick a fictional body region. **Cut**, then **sew**. Blood is visible. Entertainment only, not training.

## What exists (HEAD `5304649`)

- Warning → hub → field. Regions: forearm, knee, tooth, belly. Locked 胸/脊/眼.
- `PHASES` = prepare, expose, operate, hemostasis, close. 4–6 tools per region (gauze, scalpel, forceps, suction, irrigator, needle, bandage, elevator, grasper, bag).
- Slip can stall a phase. Save `qingxin.games.operation` schema **1**: `graphicAck`, `stars`, `lessSpray`, `lowDetail`, `audioWanted`, `dockCollapsed`.
- 器械声 opt-in, default off.

## Approaches

### A. Hide the five-phase HUD, keep the FSM (reject)

Hidden tool list. Forbidden.

### B. One magic tool (reject)

Fails “cut then sew.”

### C. Recommend: two tools, two actions, four regions

## Contract (no extra chores)

| | v1 |
|---|---|
| Tools on the field | **刀** (`scalpel`) and **缝针** (`needle`) **only** |
| Actions | **切开** (path) then **缝合** (path) |
| Regions | Same four. Tooth is a marked gum **cut** then **sew**, not elevator/quiz |
| Warning | Same copy + **我已知晓，进入手术**. `graphicAck` persists. HUD mark **含血腥 · 虚构娱乐，不是医疗训练** |
| Blood | Cut raises `bleed` and shows film/pool. Sewing **lowers** bleed. No suction/gauze/irrigate minigame |
| Slip | Visual nick only. **Does not** reset progress, phase, or the wound |
| Stars | 1–3 from path accuracy after sew. Time is not a fail |
| Mute | Default off. 少喷溅 / 低细腻 stay |

Illegal third tool: do not ship the button. If a stale save names one, ignore and select 刀.

No hidden prepare/expose/hemostasis, no dual-tool bag/stone chores, no “flush then pack then wrap.” Belly: cut a small line, sew it. Knee/forearm: cut the marked line, sew. Tooth: cut the marked gum line, sew.

## Save

Key `qingxin.games.operation`. **Schema 2**.

- Schema 1: keep `graphicAck`, `stars` (four ids), `lastSeed`, `lessSpray`, `lowDetail`, `audioWanted`, `dockCollapsed`. Drop in-field `phase`/`tool`. Next field entry starts at **切开**.
- Foreign schema: empty save, warning if `graphicAck` missing. Other `qingxin.*` keys untouched.

Catalog `about` must drop 准备/显露/止血/冲洗/器械清单 and say 切开、缝合.

## Errors / LOD

WebGL fail: 2D path still cut/sew. Reduced-motion: particle cap 0, wound + blood film remain. Lane R stays; no clay toggle.

## Test acceptance (when implemented)

- Unit: `PHASES` is exactly `cut`, `sew` (labels 切开 / 缝合); `legalTools` ⊆ {scalpel, needle}; slip does not zero `progress`; schema 1 stars survive.
- Playwright: warning still blocks hub; no 吸引/冲洗/纱布/挺子 in the kit; forearm cut then sew → `data-complete=1`; 390 both tools ≥44 px; 器械声 only after opt-in; sibling catalog boots.

## Out of scope

New regions, clinical copy, paid scans, SPH blood, five-phase restoration, merge/Mac.
