# 中医馆 Hospital Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline (user delegated existing cloud workflow; no subagent fanout). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the t278u/t280u-approved **中医馆** clinic (`story-clinic`) as a 3D waiting hall + jar cabinet: fictional patient talk → examine → ≤80-char slip + 2–5 jars (药包 1–3) → 抓药 animation → story-tag recovery (≥2 / 1 / 0), with a persistent entertainment disclaimer. Not a quiz and not any-herb-wins.

**Architecture:** Headless `clinic/sim.ts` owns cases, herbs, tags, matching, phases. `persist.ts` writes only `qingxin.games.story-clinic` schema 1. `render.ts` is one Three.js hall (bench + patient + 12-jar cabinet). `ClinicPlay.svelte` is pointer + slip gameplay, not a multiple-choice quiz. Catalog title is **中医馆**, englishTitle **Hospital**, search **医院**. Cover motif is a procedural **clinic** cabinet + lamp, not 手术 gore.

**Tech Stack:** SvelteKit 3, TypeScript, three ^0.187, Vitest, Playwright. Pointer Events + `touch-action: none` on the stage. Jar chips `CONTROL_MIN_PX` 44. Safe-area on HUD. `text-wrap: pretty` on dock/disclaimer. `maxlength=80` on the slip.

## Global Constraints

- Base `a27ab5ec` (cooking polish, PR #53) which already contains shelf `47211a92` and cloud left/right `0394185`. Branch `cursor/story-clinic-4e4e`, stack on PR **#53**, base `cursor/home-kitchen-4e4e`. Do not rewrite Mac-bound cooking/shelf pins.
- Catalog id `story-clinic`, title **中医馆**, englishTitle **Hospital**, category **益智**, tags `医院, 中医, 处方, 虚构`, playCta **开始接诊**, play `/modules/games/story-clinic/play`. Title is never 医馆 or 灶台. Summary and tags contain **医院**.
- Save key `qingxin.games.story-clinic` schema **1**. Never read/write sibling `qingxin.games.*` (including `home-kitchen` and `operation`) or `qingxin.theme`.
- Matching: score = distinct **case** tags covered by selected herbs. ≥2 warm recovery (echo matched tags); 1 partial (ask missing tag); 0 funny mismatch, patient is **fine**. Several 2–5 jar sets can reach ≥2. `<2` jars cannot 抓药 (`还没选药`). Never claim herbs **treated** an illness.
- Slip free text **≤80** chars. Jars **2–5**. Quantity **药包** integers **1–3**, never g / 钱 / 撮 / 把 / mg.
- Copy never matches `/疗效|主治|治愈|mg|适应症/`. No textbook 方剂 names as this game’s recipe. No real patient data.
- HUD always: **虚构娱乐，不是诊疗，没有真实剂量，不能当医嘱。** Disclaimer gate before the hall. `disclaimerAck` persists. Operation keeps its **own** gore warning (`我已知晓，进入手术`) and does not share this ack.
- Audio default off. Reduced-motion: skip 抓药 lunge, keep text. Low-detail: hall + cabinet plates, DPR 1 on 390. WebGL fail: dialogue + herb grid + slip.
- Guest/offline. Natural desktop + 390. Reload restores ack / last slip / seen cases. Preserve cooking, cloud signed-right, shelf, cargo, 手术, 年报 (no annual production code). No stock sim. No CI/review subscriptions.

## File map

- Create: `web/src/lib/games/clinic/sim.ts` + `sim.spec.ts`
- Create: `web/src/lib/games/clinic/persist.ts` + `persist.spec.ts`
- Create: `web/src/lib/games/clinic/render.ts`, `audio.ts`, `ClinicPlay.svelte`
- Modify: `web/src/lib/games/catalog.ts`, `catalog.spec.ts`, `filter.spec.ts`, `GameCover.svelte`
- Modify: `web/src/routes/modules/games/[id]/play/+page.svelte`
- Create: `web/e2e/story-clinic.e2e.ts`
- Modify: `web/e2e/games.e2e.ts` — search 中医馆 / 医院
- Modify: kitchen persist siblings already mention `story-clinic`; clinic persist must leave `home-kitchen` and `operation` intact

## Self-review vs spec

| Spec | Plan |
|---|---|
| Title 中医馆, english Hospital, search 医院, not 医馆 | catalog + filter + e2e |
| id story-clinic, play 开始接诊 | catalog + play switch |
| Cover clinic cabinet+lamp, not gore | GameCover `clinic` |
| Disclaimer gate; HUD 虚构娱乐…不能当医嘱 | ClinicPlay + `DISCLAIMER_COPY` / `ACK_LABEL` |
| 3D waiting hall + seated fictional patient | render hall/bench/patient |
| Dialogue 3–5 lines; story tags after talk | `advanceTalk` reveals lines then tags |
| 望/闻/把脉 each flavor one case tag | `examine(kind)` |
| Slip ≤80 + pick 2–5 jars, 药包 1–3 | `setSlip` / `toggleJar` / `setPacks` |
| 抓药 animation → recovery story | phase `dispense` then `recovery` |
| Match ≥2 / 1 / 0, not any-herb-wins | `coverTags` / `outcomeFor` |
| Two different sets both ≥2; 0-overlap not warm | sim.spec |
| Persist schema 1, seenCaseIds cap 24, last slip | persist.spec; no grams |
| 手术 own gore ack | e2e operation warning still `我已知晓，进入手术` |
| 390 jars ≥44px; all targets in canvas | compact camera width<500; assertReachable |
| WebGL fail 2D grid | ClinicPlay `sceneFailed` |
| No 疗效/主治/治愈/mg | unit + e2e regex |
| Cooking/cloud/shelf/cargo siblings | e2e boots |

No placeholders. Types below are the contract for every later task.

## Types (locked)

```ts
export const CLINIC_SCHEMA = 1;
export const SLIP_MAX = 80;
export const JAR_MIN = 2;
export const JAR_MAX = 5;
export const PACK_MIN = 1;
export const PACK_MAX = 3;
export const SEEN_CAP = 24;

export const STORY_TAGS = [
	'怕风', '夜咳', '口干', '腹鸣', '舌彩', '困午',
	'身沉', '怕湿', '眠浅', '气短', '喉甜'
] as const;
export type StoryTag = (typeof STORY_TAGS)[number];

export const HERB_IDS = [
	'danggui', 'huangqi', 'gouqi', 'juhua', 'gancao', 'fuling',
	'chenpi', 'shengjiang', 'hongzao', 'bohe', 'guizhi', 'baizhu'
] as const;
export type HerbId = (typeof HERB_IDS)[number];

export const CASE_IDS = ['fox-draft', 'clerk-tea', 'turtle-well', 'kite-cloud'] as const;
export type CaseId = (typeof CASE_IDS)[number];

export type ClinicPhase =
	| 'disclaimer' | 'hall' | 'talk' | 'examine' | 'write' | 'dispense' | 'recovery';
export type ExamineKind = 'look' | 'listen' | 'pulse';
export type ClinicOutcome = 'warm' | 'partial' | 'mismatch';

export type PickedJar = { id: HerbId; packs: number };

export type ClinicWorld = {
	phase: ClinicPhase;
	disclaimerAck: boolean;
	caseId: CaseId;
	talkIndex: number;
	revealedTags: StoryTag[];
	examined: ExamineKind[];
	examineNote: string;
	slip: string;
	jars: PickedJar[];
	notice: string;
	recovery: string;
	covered: StoryTag[];
	seenCaseIds: CaseId[];
	lastSlip: { text: string; herbs: PickedJar[] } | null;
	lowDetail: boolean;
	audioWanted: boolean;
	dockCollapsed: boolean;
	paused: boolean;
	recovered: boolean;
	dispenseT: number;
	narrow: boolean;
};
```

Cases (fictional, not people):

| id | name | tags |
|---|---|---|
| fox-draft | 梦里受风的狐狸 | 怕风, 夜咳, 口干 |
| clerk-tea | 喝了彩虹茶的书记员 | 腹鸣, 舌彩, 困午 |
| turtle-well | 在月井打盹的石龟 | 身沉, 怕湿, 眠浅 |
| kite-cloud | 卡在饺子云里的风筝 | 气短, 喉甜, 怕风 |

Herbs (flavor names, 1–2 story tags, never 方剂):

当归 怕风/身沉 · 黄芪 气短/困午 · 枸杞 口干/眠浅 · 菊花 夜咳/喉甜 · 甘草 腹鸣/喉甜 · 茯苓 怕湿/腹鸣 · 陈皮 腹鸣/困午 · 生姜 怕风/夜咳 · 红枣 口干/身沉 · 薄荷 舌彩/喉甜 · 桂枝 怕风/眠浅 · 白术 怕湿/困午

Fox ≥2 sets: `{当归,菊花}` and `{生姜,枸杞}`. Fox 0-overlap: `{茯苓,白术}`.

Copy constants (no medical claims):

```ts
export const HUD_DISCLAIMER = '虚构娱乐，不是诊疗，没有真实剂量，不能当医嘱。';
export const DISCLAIMER_COPY =
	'本馆病例都是编的。药名只是气味标签，数量是游戏里的药包，不是克、钱或医嘱。点「我明白，开始虚构接诊」进候诊厅。';
export const ACK_LABEL = '我明白，开始虚构接诊';
```

---

### Task 1: Headless sim (TDD)

**Files:** Create `web/src/lib/games/clinic/sim.ts`, `sim.spec.ts`

- [ ] Failing then passing unit tests for: two ≥2 sets on fox; 茯苓+白术 is mismatch not warm; `<2` jars `还没选药`; 6th jar rejected; slip truncated at 80; 药包 clamped 1–3; talk then 3 tags; examine adds flavor not ICD; all copy `/疗效|主治|治愈|mg|适应症/` empty; `outcomeFor` never says 治愈.

- [ ] Commit `feat(clinic): story-tag matching and 药包 slip`

---

### Task 2: Persist schema 1

**Files:** Create `persist.ts`, `persist.spec.ts`

- [ ] Round-trip `disclaimerAck`, `seenCaseIds` (cap 24), last slip text+herb ids+药包. Foreign/corrupt → fresh hall, disclaimer if ack missing. Sibling keys including `qingxin.games.home-kitchen`, `qingxin.games.operation`, `qingxin.theme` untouched. Serialized JSON never contains `g`, `克`, `钱`, `mg`.

- [ ] Commit `feat(clinic): schema 1 story-clinic save`

---

### Task 3: Catalog 中医馆 + clinic cover

**Files:** `catalog.ts`, `catalog.spec.ts`, `filter.spec.ts`, `GameCover.svelte`, `play/+page.svelte`

- [ ] `CoverMotif` adds `'clinic'`. Card: title 中医馆, englishTitle Hospital, not 医馆. Search 医院 and 中医馆 hit it. Category 益智.
- [ ] Cover: cabinet + lamp, no gore / OR table.
- [ ] Play switch `story-clinic` → `ClinicPlay`
- [ ] Commit `feat(clinic): catalog 中医馆 with cabinet cover`

---

### Task 4: 3D hall + HUD + 2D fallback

**Files:** `render.ts`, `audio.ts`, `ClinicPlay.svelte`

Pointer on stage, `touch-action: none`. Hit `patient` / `jar`. Dataset: `data-ready`, `data-phase`, `data-ack`, `data-case`, `data-talk`, `data-tags`, `data-jars`, `data-slip`, `data-score`, `data-inbox`, `data-px`/`data-py` patient, `data-jx-{id}` jars.

Compact if canvas width `< 500`: 4×3 jar grid + patient fully inside pad 28. Overlay labels on jars. Slip `maxlength=80`. 望/闻/把脉 44px. 抓药 button. Reduced-motion skips lunge.

- [ ] Commit `feat(clinic): 3D hall talk, examine, jars, recovery`

---

### Task 5: Playwright + screenshots + STOP

**File:** `web/e2e/story-clinic.e2e.ts` (+ games.e2e search)

Natural pointer only.

- Catalog 中医馆 / Hospital / 医院 / 开始接诊 / not 医馆
- Disclaimer before hall; ack persists
- 1280: talk → tags → examine → write ≤80 → pick 2–5 → 抓药 → recovery; copy never `/疗效|主治|治愈|mg/`
- DualShot raw hall / examine / prescribe / dispense / recovery at 1280 and 390; `data-inbox=1`; all 12 jars + patient boxes
- 390 jar chips ≥44px; no edge clip
- Reload keeps ack + last slip
- 手术 still shows 我已知晓，进入手术 and does not read clinic ack
- Siblings: kitchen, cargo, cloud signed-right, operation, shelf, 年报/潮汐/店/上班

Inspect PNGs before claim. `svelte-check`; full vitest; `CI=1` clinic e2e. Push. ManagePullRequest stack_on **53**. STOP. No annual production, no stock, no CI subscribe.
