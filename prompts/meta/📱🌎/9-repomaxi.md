# TASK-GENERATION BRIEF — myPlanet refactor round

## role
you are generating work orders for OTHER coding agents (jules, codex, copilot,
devin, openhands, claude, qwen). they will execute your tasks verbatim and
cannot ask follow-up questions. your output is a plan, not code — you do not
modify any files in this run.

## goal
produce exactly 10 independent tasks that advance this roadmap:

1. finish cleaning the data layer
2. introduce global navigation architecture
3. expand viewmodel and use-case layers
4. complete dependency-injection cleanup
5. consolidate sync and upload workflow
6. migrate ui incrementally to compose
7. optimize remaining performance hotspots
8. improve code health and add tests
north star — never scheduled directly, never blocked:
9. kotlin multiplatform: a platform-free kotlin core — repositories, models,
   sync/upload logic and use cases end up with zero android.* imports
10. compose multiplatform: every compose screen from 6 stays portable — state
    hoisted into viewmodels, no android views inside composables, no direct R.*

every task states which roadmap number it serves and, where true, how it also
moves 9/10 forward.

## this round's focus
reinforcing repository boundaries between layers
call out cross-feature data leaks and tighten repository interfaces
look also to find data functions to move one by one from UI/data/service into repositories
other dao room optimizations
and last smoother repository view modelling relationships

## hard rules — violating any one invalidates the whole plan
R1 exactly 10 tasks, each independently mergeable in any order
R2 no file appears in more than one task
R3 list the currently OPEN pull requests before writing; any file an open PR
   touches is off-limits. if your platform cannot see open PRs, write
   "could not check open PRs" in the header and avoid the hot areas named in
   the focus block instead of guessing
R4 every file path, class and function you cite must exist — open the file and
   confirm before citing. no invented paths, no "e.g." paths
R5 per task: under ~150 changed lines, under ~5 files, no new dependencies,
   no unused code, no TODO placeholders
R6 you write no implementation code — the plan is the deliverable

## process — do these in order, do not skip P1
P1 search the actual code for candidate spots matching the focus block
P2 check recently open PRs (R3), discard colliding candidates
P3 rank what remains by user impact divided by blast radius
P4 write the top 10 as full work orders using the template below
P5 run the self-check, fix violations silently, then output

## task template — every section, every task
### <n>. <imperative title> (roadmap <numbers>)
context: 2-3 sentences — what is wrong today, why it matters, evidence as file:line
files: exact paths + class/function names to touch, AND neighbors to leave alone
steps: 3-6 numbered concrete edits
acceptance: exact commands that must pass (./gradlew testDefaultDebugUnitTest
  stays green) + the user-visible behavior to verify
size budget: expected changed lines and file count
out of scope: 1-2 lines on what NOT to do

## quality bar
BAD — reject, not executable without questions:
    Optimize the members screen.
    Use a count query instead of loading all members.
GOOD — match this density:
    ### 1. replace member-count list load with the existing count query (roadmap 1+7)
    context: RequestsViewModel.kt:39 calls getJoinedMembers(teamId).size, which
    loads every membership row plus one user query per member, to produce an Int.
    the repository already exposes getJoinedMemberCount(teamId) backed by SQL COUNT.
    files: app/src/main/java/org/ole/planet/myplanet/ui/teams/members/RequestsViewModel.kt
    (line 39). do NOT touch TeamsRepositoryImpl — open PRs own it.
    steps: 1. swap the call 2. remove unused imports 3. run the unit tests
    acceptance: ./gradlew testDefaultDebugUnitTest green; requests screen still
    shows the correct joined-member count
    size budget: ~2 changed lines, 1 file
    out of scope: no DAO changes, no repository changes

## output contract
- one markdown document; tasks separated by a line containing only ---
- header lines: date · base commit · open PRs checked (numbers) or "could not check"
- no implementation code blocks; code snippets only as short evidence quotes

## self-check — verify each box before answering; fix, don't explain 
[ ] exactly 10 tasks 
[ ] no file in two tasks 
[ ] every cited path was opened and confirmed to exist 
[ ] every task has all 7 template sections 
[ ] no task under 15 lines — rewrite any that is 
[ ] no task touches a file from the open-PR list with tag review ready merge
[ ] one tasks markdown document written to `docs/` directory 
[ ] dedicated branch created, committed, and pushed 
[ ] response terminates with the full URL to the markdown document on the pushed branch 
