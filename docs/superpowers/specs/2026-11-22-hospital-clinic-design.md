# 中医馆 Hospital (t278u)

**Approved to implement** (Ge t278u `'approved'` 2026-11-22 14:21 Asia/Shanghai). **New** catalog game. Display title **中医馆**, englishTitle **Hospital**. Tags and summary **must include 医院** so catalog search finds both. Do **not** ship the catalog title 医馆 or 灶台.

This is **fictional medical entertainment**. Not a hospital product, not a TCM textbook, not diagnosis of real people.

**Status:** written spec for review. No app code in this commit. GPU frame time has **not** been measured.

## Player fantasy

A small clinic. Talk to a **fictional** patient. Look / listen / pulse as **game gestures**. Write a slip and pick herbs. Dispense. They come back with a **story** recovery. You can reason about the case. It is not a quiz with one radio answer, and it is not “any three jars always win.”

## Approaches

### A. Multiple-choice “which herb?” (reject)

Fails t278u.

### B. Any herb set clears every case (reject)

No reason to read the patient.

### C. Real formulas, grams, efficacy copy (reject)

Looks clinical. Forbidden.

### D. Recommend: fictional cases + story-tag matching + 药包

Respectful tone. No parody of legitimate TCM. No real doses, no real formulas as treatment guidance, no “本方主治”.

## Catalog / route

| | v1 |
|---|---|
| id | `story-clinic` (stable; documented, not the display name) |
| title | **中医馆** |
| englishTitle | **Hospital** |
| category | 益智 |
| tags | `医院, 中医, 处方, 虚构` |
| summary | Must contain **医院** and **虚构** |
| playCta | **开始接诊** |
| cover motif | new `clinic` (procedural cabinet + lamp, not 手术 gore, not paid atlas) |
| play | `/modules/games/story-clinic/play` |

Persistent HUD: **虚构娱乐，不是诊疗，没有真实剂量，不能当医嘱。**

First play: a short **disclaimer** gate (not the surgery gore gate). `disclaimerAck` persists. Copy states: cases are made up; herb names are flavor; amounts are game **药包**; nothing here is a real prescription.

## Loop

1. Waiting hall (3D) → one seated **fictional** patient (fox who caught a draft in a dream, clerk who drank rainbow tea, …). Clearly not a real person. No real patient data.
2. **Dialogue:** 3–5 lines of complaint in character. Visible **story tags** after talk (e.g. 怕风, 夜咳, 口干) — game labels, **not** ICD, **not** 证型 presented as diagnosis.
3. **Examine:** 望 / 闻 / 把脉 as three gestures. Each reveals at most one extra **story tag** already in the case. Flavor text only.
4. **Write** a slip: free text ≤80 chars **and** pick **2–5** jars. Herb names may be common real names (当归, 黄芪, 枸杞, 菊花, 甘草, 茯苓, 陈皮, …) for flavor. Quantity is **药包** integers 1–3 per jar, never g / 钱 / 撮 / 把.
5. **抓药** animation → patient leaves → returns with a **fictional** recovery beat.

### Matching (meaningful, not a gotcha)

Each case has 3 story tags. Each herb has 1–2 **flavor** tags in the same vocabulary. Score = count of distinct case tags covered by the selected herbs.

| Covered tags | Outcome (all fictional) |
|---|---|
| ≥2 | Warm recovery story; tags you matched are echoed in the joke |
| 1 | Partial, still kind; patient asks about the missing tag |
| 0 | Funny mismatch story; patient is **fine**; not punished, not “wrong medicine” |

Several herb sets can reach ≥2. There is **no** single correct list. Empty pick (<2 jars) cannot dispense (notice 还没选药). Matching never claims the herbs **treated** an illness.

Do not show 疗效, 主治, 适应症, 治愈, mg, or textbook 方剂 names as if they were this game’s recipe.

## Save

Key **`qingxin.games.story-clinic`** schema 1. Fields: `disclaimerAck`, `seenCaseIds` (cap 24), last slip (text + herb ids + 药包), `lowDetail`, `audioWanted`, `dockCollapsed`. Missing / foreign: fresh hall, disclaimer if ack missing. **Never** touch `qingxin.games.operation` or any other sibling key.

## Errors / LOD

WebGL fail: still dialogue + herb grid + slip. Reduced-motion: skip lunge, keep text. Low-detail: hall + cabinet plates, DPR 1 on 390. Audio default off. GPU unmeasured.

## Test acceptance (when implemented)

- Unit: two different 2–5 herb sets can both score ≥2 on the same case; a 0-overlap set does **not** use the ≥2 copy; 药包 is integer 1–3; persist never stores grams; sibling keys untouched.
- Playwright: catalog **中医馆** and text **医院**; disclaimer before the hall; complete one case via talk → examine → write → pick → dispense → return story; copy never matches `/疗效|主治|治愈|mg/`; 390 jars ≥44 px; 手术 still has its **own** gore warning and does not share this ack.

## Out of scope

Real patient records, real doses, efficacy claims, mocking TCM, surgery gore, paid anatomy, merge/Mac.
