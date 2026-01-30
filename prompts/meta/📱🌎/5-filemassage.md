Create a copyable markdown report composed of AT LEAST 15 granular refactoring tasks that massage files internally (edit contents only).

Goal:
- Pure cleanup + naming consistency INSIDE existing files
- No renaming packages/directories
- No moving files
- No architectural changes
- No new classes, no new ViewModels, no features

Target refactoring themes (in-file edits):
- Rename inconsistent classes/types within a file and update local references
- Rename methods/properties for convention consistency (get/set/is/has, onX/handleX/updateX)
- Normalize constant naming (TAG, EXTRA_*, ARG_*, keys)
- Remove unused imports + obvious dead/commented-out code
- Normalize ordering (imports, constants, members) without altering behavior

Parallelization / merge-conflict rules (critical):
- Each task must target a disjoint file set; a file may appear in ONLY ONE task
- Prefer exactly 1 file per task
- If a rename impacts references in other files, keep the full impacted closure inside the same task and cap at 3 files
- No “global formatting sweep” tasks

AVOID:
- Any semantic or behavioral changes
- Any refactors that require new helper extraction
- Any new abstractions or major restructuring
- Any directory/package changes

Deliverables:
- 15+ tasks, as granular as possible
- Each task includes 1–3 sentences rationale
- Each task includes at least one citation line referencing the exact lines motivating the task
- No code output, no diffs, no patches

Output must follow this grammar exactly:

document  := { finding_section } [ testing_section ]

finding_section :=
  "### " title "\n"
  rationale_paragraph "\n"
  { "\n" citation_line }
  "\n"
  task_stub_block "\n"

title := <short text, no trailing period>

rationale_paragraph := <1–3 sentences, plain text>

citation_line :=
  ":codex-file-citation[codex-file-citation]{"
  "line_range_start=" int " "
  "line_range_end=" int " "
  "path=" path " "
  "git_url=\"" url "#L" int "-L" int "\"}"

task_stub_block :=
  ":::task-stub{title=\"" task_title "\"}\n"
  step_line
  { "\n" step_line }
  "\n:::"

step_line := int "." space step_text
