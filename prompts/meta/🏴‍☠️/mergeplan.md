# Merge-plan generator

Analyse the open PRs carrying a given label, produce a wave-ordered merge plan backed by
real three-way merges, and hand any follow-up to whoever should actually do it. Report
only what you verified.

---

## Inputs

- `REPO`, `BASE` (default `master`)
- `MERGE_LABEL` — "reviewed, land it". **Confirm this every run; it gets renamed**
  (`ready to merge` → `merge`)
- `PRIORITY_LABEL` (`priority`) — soon-ready; protect it, hold whatever conflicts with it
- `READY_LABEL` (`ready`) — pre-review; report impact only, never merge
- `QUEUE_LABEL` (`automerge`) — what the drainer workflow consumes

---

## 1. Ground truth — get these wrong and every later number is fiction

1. **The clone is shallow.** At depth 50 `git merge-base` silently returns nothing usable
   and healthy PRs look unmergeable. `git fetch --deepen=3000`, then confirm with
   `git rev-list --count origin/BASE`.
2. **`origin/BASE` can be stale even when `HEAD` is ahead of it.** Re-fetch and re-read
   the SHA; never trust the ref you were handed.
3. **Fetch every PR head once:**
   `git fetch origin '+refs/pull/*/head:refs/remotes/pr/*'`
   The whole analysis then runs locally, no API in the hot loop.
4. Requires git ≥ 2.38 for `merge-tree --write-tree`.
5. **Stamp the snapshot.** Record the `BASE` SHA and the time you fetched PR heads, and
   print both in the output. PR heads move — maintainers amend, agents push, and the
   drainer merges `BASE` into each PR before merging it. A plan more than a few hours old
   must be re-fetched before its numbers mean anything.

## 2. Getting the PR list

- Use `list_pull_requests` paginated (100/page) and filter labels **locally**.
- `search_pull_requests` with a label query **undercounts** — 61 vs 70 for the same label
  on the same repo — and its index **lags writes by minutes**. Never use it as the source
  of truth; use it only for a rough cross-check.
- Both blow the tool-output token cap. Save the raw result to a file and parse it with
  python. The `fields` parameter does not shrink it enough.
- Later pages are usually stale WIP PRs carrying none of the target labels. Verify, then
  ignore.

## 3. Conflict detection — three-way merges only

File-overlap heuristics produce garbage. Use the engine GitHub uses:

```bash
tree=$(git merge-tree --write-tree BASE prA)        # rc 0 = clean, 1 = conflict
c=$(git commit-tree $tree -p BASE -p prA -m tmp)    # chain to test a second PR on top
git merge-tree --write-tree $c prB
```

- Only test a pair if the two PRs share a changed file.
- **Every conflict edge is symmetric.** Verified across multiple runs. Never build
  "merge in this order" chains — a contended file means somebody rebases, and no ordering
  rescues it. If a pass reports order-dependence, the cause is PRs that already conflict
  with `BASE` being untestable: exclude those and re-run.
- Simulate the chosen wave **cumulatively** by chaining `commit-tree`, and report the
  failure list even when it is empty.

## 4. Building the waves

1. Split the `MERGE_LABEL` set into clean-vs-`BASE` and conflicts-with-`BASE`. The latter
   is the final wave regardless of this plan.
2. **Priority protection:** anything conflicting with a `PRIORITY_LABEL` PR is held,
   whatever its own labels say. **Quantify the cost** — compute the greedy maximum
   independent set with and without protection and state the delta in PRs (one run:
   51 → 48, so the rule cost 3). A priority PR that also carries `MERGE_LABEL` is the
   expensive case: it merges *and* displaces.
3. Greedy MIS on the remainder, tie-broken in this order: priority, **external
   contributor**, lowest conflict degree, largest diff. Protecting external contributors
   is usually free — verify before assuming it costs anything.
4. Name the highest-degree hub explicitly: sacrificing one often unlocks many.

## 5. Signals that are hints, not gates

Classify every in-play title: **house** (`area: smoother thing verbing (fixes #N)`),
**partial** (issue linked, no `area:` prefix — in practice always an external
contributor), **raw** (untouched since the agent opened it).

Raw correlates with rot — one run measured 19% raw among the mergeable wave against 67%
among PRs already broken against `BASE` — because a raw title means "never triaged" and
untriaged PRs sit long enough to break. Useful for **ordering triage**. Two traps make it
useless as a gate:

- **Attribution.** Doer agents post and edit under the *summoning user's* account, not
  their own. A house-style title bearing the maintainer's handle does **not** mean the
  maintainer wrote it. Check the PR timeline, never the `user` field. Getting this
  backwards inverts the entire finding.
- **Staleness.** If a prepping agent is working the same backlog, the audit decays within
  hours. Re-read live titles immediately before publishing and drop rows already handled,
  or you ship a list of solved problems.

Never gate the *plan* on title style — it would eject the maintainer's own priority PR.
Gate the *queue* only after confirming nothing is already fixing it (see §6).

## 6. Check what is already delegated

Before building any summon worklist, look for evidence the agent has already been called:

- house titles on PRs that otherwise look untouched;
- tracking issues numbered **above** the PRs referencing them — a retitle opens the issue
  after the fact, so `PR #15383 (fixes #15513)` is the signature of an automated rename;
- bot comments, or commits whose timeline actor differs from the commit author.

Hand over only what is genuinely unhandled. If you do build a worklist, per row give the
copy-ready summon naming the skill, the proposed title, and the missing-issue instruction,
plus a prefilled `issues/new?title=&body=` link as the manual path. And:

- Mentioning an agent handle in a GitHub comment **is** the summon, and backticks do not
  defuse it. Never write a live handle into anything that could reach GitHub verbatim;
  assemble it at render time.
- One session per mention — say so, so N rows are not pasted blind.
- Doer agents push by default. The summon must say "retitle only, do not push", and the
  reader should be told to check the timeline, because that leash has been broken before.

## 7. Reporting

- **Open with how far the previous plan got** — landed vs still open per wave — and name
  PRs that decayed from an early wave into the broken bucket. That number is the
  measurable cost of a plan sitting unexecuted.
- State the `BASE` SHA and snapshot time, and say the plan must be re-run if `BASE` moves
  for any reason other than executing it.
- Say plainly that conflict detection is **textual**: a clean merge is not a passing build.
  Flag same-file clusters landing together as semantic risk and recommend running tests
  mid-wave, not only at the end.
- Note that squash-merge carries the PR title into `BASE` permanently, so title quality
  matters for anything queued — then say whether something is already handling it.

## 8. Asking, and executing

- **Ask before any GitHub write. Ask once, in plain numbered text with defaults,
  answerable as `1b 2a 3a`.** Interactive question cards time out; three consecutive
  dismissals cost a full round trip each and teach the user nothing.
- The issues API **replaces the entire label array**. Always send existing labels plus the
  new one, or existing minus the removed one. Read current labels first — do not reuse a
  cached list from earlier in the session.
- Prefer proposing over applying. Renames, new issues and label changes are cheap to undo
  but noisy to review in bulk.

## 9. Verifying afterwards

Do not trust a label search to confirm a bulk write — its index lags. Reconcile against
the full set and account for **every** PR:

- **merged** — confirm from `git log BASE` on the merge subjects, not from the API
- **open + `QUEUE_LABEL`** — the live queue
- **open, label missing** — someone or something removed it; say so, do not silently re-add
- **closed *without* merging while still labelled** — the drainer dropped it. Always call
  this out; it is the failure mode nobody notices.
- **`mergeable_state: dirty`** on a PR your simulation said was clean — the ref moved
  since your snapshot. Re-fetch before re-asserting any number.

Sum the buckets and check they equal the wave size. If they do not, the search index is
behind — verify the stragglers with a direct per-PR read.
