an analysis suggested

Refactor Roadmap (High → Low Priority)
1. Finish Cleaning the Data Layer
2. Introduce Global Navigation Architecture
3. Expand ViewModel and Use Layers
4. Complete Dependency Injection Cleanup
5. Consolidate Sync and Upload Workflow
6. Migrate UI Incrementally to Compose
7. Optimize Remaining Performance Hotspots
8. Improve Code Health and Add Tests

based on that tell me all the spots with tasks we should do to accomplish above suggestion
remember we can only review 9.99ish pr s a round/day
give me 10 tasks
Mostly we wanna avoid merge conflicts during this PR review merge round
also this time focus specially on
performance quick wins
micro-optimizations that unblock bigger refactors later
anything that removes obvious inefficiencies without big rewrites

consider though
di
data layers
diffutil / listadapter (also use our DiffUtils.itemCallback)
viewmodels
threading / dispatchers usage
long running observers or listeners

No use cases no jetpack stuff
we want low hanging fruits
no complicated stuff with many changes
so it is easily reviewable
also do not add unused code
keep it as granular as possible

do not work on coding
focus on this report of 10 tasks

whichs output you format the following way
```
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
```
ps there is no code output
we want an easy copyable plan
composed of at least 10 tasks
in above grammar
output into a markdown file
and/or in an easy copyable way
