# Test plan — W2 end-of-iteration

**Date**: 2026-05-17
**Scope**: everything implemented up to commit `8b7e6e4`
**Pre-req**: dev server running (`pnpm --filter @singularity/web dev`), signed in as `justinliuforever@gmail.com`

Automated baseline: `pnpm --filter @singularity/db sanity-check`

**Last run output** (2026-05-17, commit 8b7e6e4):

```
[G1] Row counts (expecting xlsx TOTAL row)
  ✓ channels: 10 (expected 10)
  ✓ clerk_videos: 218 (expected 218)
  ✓ clerk_sops: 31 (expected 31)
  ✓ muse_monitor_videos: 10 (expected 10)
  ✓ muse_ideas: 50 (expected 50)
  ✓ poet_bible: 7 (expected 7)
  ✓ poet_custom_topics: 18 (expected 18)

[G2-G5] FK integrity — orphans must be 0
  ✓ clerk_videos → channels: 0 orphans
  ✓ clerk_sops → channels: 0 orphans
  ✓ muse_ideas.source_video_id resolves: 0 dangling
  ✓ poet_custom_topics.bible_id resolves: 0 dangling
  ✓ poet_custom_topics.sop_id resolves: 0 dangling

[G6] User isolation
  ✓ all channels belong to target user: 10/10 owned
  ✓ no clerk_videos for other users: 0 foreign rows

[G7] Cascade delete probe
  ✓ probe children inserted: cv=1 mv=1 pb=1
  ✓ cascade delete cleared children: cv=0 mv=0 pb=0

[Bonus] Schema invariants
  ✓ channel slugs unique per user: ok

All sanity checks passed.
```

---

## A. Auth flow

| # | Action | Expected |
|---|---|---|
| A1 | Visit `/` in incognito | 307 → Logto sign-in page (light bg, Caveat font, Singularity logo) |
| A2 | Enter justinliuforever@gmail.com, get OTP | OTP arrives within ~30s |
| A3 | Submit OTP | Redirects through `/callback` → `/welcome` splash (3 weaving SVG lines + 3 pulsing dots) → `/` dashboard |
| A4 | Top-right avatar → Sign out | Lands on `/signed-out` (NOT auto-redirected to sign-in) — "Signed out." headline + "Sign in" button |
| A5 | Click "Sign in" on `/signed-out` | Re-enters OTP flow |
| A6 | While signed in, visit `/signed-out` directly | Renders (public page) — clicking Sign in re-auths cleanly |
| A7 | While signed in, visit `/api/auth/sign-in` | Returns empty 200 (signIn server action already redirected to Logto) |
| A8 | Wrong OTP code | Logto shows error inline, no Singularity-side error |
| A9 | Clear cookies mid-session, visit `/channels` | 307 → sign-in |
| A10 | Visit `/welcome` directly (signed in or out) | Always renders splash; auto-redirects to `/` after 1.5s |

---

## B. Channels CRUD

| # | Action | Expected |
|---|---|---|
| B1 | `/channels` | Table with **10 rows** (clerk喜洋洋与灰太阳, film-yien-wang, jimmy徕卡, kai-w, petapixel, rico-ai-xhs, 南方公园, 暴打咸鱼传家宝, 梵高, 表叔王寂). Each row clickable (name underlined on hover) |
| B2 | Click `kai-w` | Detail page renders: name="kai-w", platform=youtube badge, URL link (opens new tab), Clerk card shows 30/3, Muse 0/0, Poet 1/3. **Clerk + Poet cards clickable, Muse card greyed** |
| B3 | Click `南方公园` (CJK slug) | URL encodes as `/channels/%E5%8D%97%E6%96%B9%E5%85%AC%E5%9C%92` — page loads fine |
| B4 | Top-right Edit | Sheet slides in from right with current values pre-filled |
| B5 | Edit kai-w description = "Test description from W2 testing", Save | Toast "Updated kai-w", sheet closes, page refreshes showing description |
| B6 | Edit + invalid URL ("not-a-url") | Inline error "Must be a valid URL", no submit |
| B7 | Edit + empty name | Inline error "Required", no submit |
| B8 | Edit + Cancel | Sheet closes, no changes |
| B9 | Click trash icon on `/channels` row | AlertDialog confirms delete; click Delete → row gone + toast |
| B10 | After delete, click trash icon for same channel (impossible — gone) | Skip |
| B11 | `/channels/new` | Create form; submit with name="Test W2", platform=youtube, URL="https://www.youtube.com/@test" | Redirects to `/channels`, new row appears at top |
| B12 | `/channels/new` with name="kai-w" (duplicate slug) | Slug auto-suffixes to "kai-w-2"; channel created |
| B13 | `/channels/new` with empty URL | Form blocks submit (HTML5 + Zod) |
| B14 | `/channels/non-existent-slug` (direct URL) | `notFound()` → 404 page |
| B15 | After B5+B11+B12, /channels has **12 rows** (10 archive + Test W2 + kai-w-2) | Verify |
| B16 | Delete Test W2 + kai-w-2 to restore baseline | Back to 10 rows |

---

## C. Clerk views

| # | Action | Expected |
|---|---|---|
| C1 | `/clerk` | 10 rows (every channel has clerk_videos) sorted by last analyzed desc |
| C2 | `/clerk/表叔王寂` | Header "表叔王寂", 30 videos badge, table sorted by views desc |
| C3 | `/clerk/non-existent` | 404 |
| C4 | Click first video row in `/clerk/南方公园` (50 videos) | Detail page renders fast (< 1s); 14 sections + transcript section |
| C5 | Detail page: sections with NULL data omitted | Verify any NULL field (rare in archive data) doesn't render empty heading |
| C6 | Detail page back button | Returns to `/clerk/南方公园` (not browser back) |
| C7 | Detail page external URL link | Opens YouTube in new tab (`target="_blank"`) |
| C8 | Detail page with truncated field | Long text ends with `…` (Unicode ellipsis from xlsx) — this is expected, not a bug |
| C9 | `/clerk/[slug]/[videoId]` with wrong videoId | 404 |
| C10 | Direct deep link `/clerk/kai-w/[some_video_id]` | Works if videoId exists in DB |

---

## D. Muse views

| # | Action | Expected |
|---|---|---|
| D1 | `/muse` | 3 rows: clerk喜洋洋与灰太阳 (25 ideas), petapixel (15), 南方公园 (10) |
| D2 | `/muse/南方公园` | Header "南方公园" + "10 ideas" badge; monitored videos section (2 videos: South Park studios) + 10 idea cards |
| D3 | Idea cards show story angle, facts, why-similar, viral trigger | Verify all sections render for first card |
| D4 | Idea card "from {source title}" link | Click → opens YouTube source in new tab |
| D5 | `/muse/petapixel` (15 ideas, no monitored videos linked) | Should still render; check if `monitored` section appears empty or hidden |
| D6 | `/muse/kai-w` (0 ideas) | Page renders with channel header but no `Ideas` section — empty state |
| D7 | `/muse/non-existent` | 404 |

---

## E. Poet views

| # | Action | Expected |
|---|---|---|
| E1 | `/poet` | 4 rows: kai-w, petapixel, rico-ai-xhs, 表叔王寂. Bibles + topics counts visible |
| E2 | `/poet/表叔王寂` | 2 bibles cards (active first) + 14 topics table |
| E3 | Bible card: full content rendered with whitespace-pre-wrap | Newlines preserved |
| E4 | Topic table sorted by updatedAt desc | Verify |
| E5 | Click any topic | Topic detail page renders: reference chips at top (if any), 5 text sections (story angle / facts / verbatim / why-similar / viral trigger), linked bible + SOP at bottom |
| E6 | Topic with YouTube reference chip | Click chip → opens YouTube in new tab |
| E7 | Topic with truncated references_json | Reference chips section absent (parse failed → empty array) |
| E8 | Topic linked bible/SOP | Bible name visible, SOP type+language visible |
| E9 | `/poet/kai-w/topics/[topicId]` for topic that doesn't exist | 404 |
| E10 | `/poet/[slug]/topics/[topicId]` where slug doesn't own the topic | 404 (cross-channel access blocked) |

---

## F. Cross-cutting edge cases

| # | Scenario | Expected |
|---|---|---|
| F1 | CJK slug URL encoding | All `南方公园` / `表叔王寂` URLs round-trip correctly (browser shows `%E5%8D%97...` but page decodes and loads) |
| F2 | Refresh after mutation | tRPC React Query invalidates `channels.list` + `channels.bySlug` → UI reflects new state without full reload |
| F3 | Open two tabs, edit same channel from one, see staleness in other | Other tab shows old data until refresh. **Acceptable for W2**; OCC / optimistic locking not implemented yet |
| F4 | Browser back after edit | Returns to previous page; refreshed data is in cache |
| F5 | Deep link without auth | 307 → sign-in; after auth, **does NOT preserve original destination** (lands on `/`). Known gap; track for W3+ |
| F6 | Mobile viewport (375px) | Channels table scrolls horizontally; cards stack 1 col instead of 3 |
| F7 | Toast on mutation error | tRPC error → red toast surfaces server message |
| F8 | Very long topic content | Whitespace-pre-wrap wraps gracefully |
| F9 | Sidebar active state | Highlighting `/clerk/...` → "Clerk" item in sidebar shows isActive |

---

## G. Data integrity (run sanity-check script)

```bash
pnpm --filter @singularity/db sanity-check
```

| # | Check | Expected |
|---|---|---|
| G1 | Row count per table | channels=10, clerk_videos=218, clerk_sops=31, muse_monitor_videos=10, muse_ideas=50, poet_bible=7, poet_custom_topics=18 (matches xlsx Summary TOTAL row) |
| G2 | All clerk_videos.channel_id reference an existing channel | 0 orphans |
| G3 | All muse_ideas.source_video_id resolve (or are NULL) | No FK violations |
| G4 | All poet_custom_topics.bible_id resolve (or are NULL) | No FK violations |
| G5 | All poet_custom_topics.sop_id resolve (or are NULL) | No FK violations |
| G6 | Every row belongs to justinliuforever@gmail.com transitively | No cross-user contamination |
| G7 | Cascade delete: delete one channel → all related rows gone | Run in temp / test channel only |

---

## H. Security & auth contract (tRPC)

| # | Scenario | Expected |
|---|---|---|
| H1 | `channels.list` returns only user's channels | Verify via DB inspection: query returns same as `WHERE user_id=justinId` |
| H2 | `channels.bySlug` with slug owned by another user | Returns null (not the other user's channel) |
| H3 | `channels.update` with id of another user's channel | Throws NOT_FOUND |
| H4 | `channels.delete` with id of another user's channel | Returns `{ id: null }` (no rows affected) |
| H5 | Unauth tRPC call | 401 UNAUTHORIZED |
| H6 | tRPC mutation called twice in race | Second one either succeeds (idempotent op) or returns sensible error |

For now, single-user scenario means H1-H4 are **theoretical**. Reproduce only when adding 2nd user account (W3+).

---

## I. Known gaps / not-yet-tested

- **Playwright / unit tests**: zero. Add in W7-W8 polish.
- **Mobile UX**: not designed for it. W8 polish.
- **Error boundary**: no global error boundary — crashes cascade to Next.js default error page.
- **Loading skeletons**: only on `/channels` list (others SSR; no loading state needed).
- **Rate limiting**: no abuse protection.
- **Logto session refresh**: untested when access token expires.
- **Production deployment**: no smoke test (D6 still open).
- **Trigger.dev integration**: not yet wired (W3+).
- **Vercel AI SDK calls**: not yet wired (W3+).

---

## Walkthrough order

1. **Run sanity-check first** — if any G check fails, stop and fix before manual.
2. Walk A → B → C → D → E (UI pages, each 5-10 min) → F (cross-cutting edge cases) → H (security; skim for now).
3. Log any failure as a row in this file ("**FAIL**: ..."), commit, then we triage.

Estimated full walkthrough: **45 min – 1 hour**.
