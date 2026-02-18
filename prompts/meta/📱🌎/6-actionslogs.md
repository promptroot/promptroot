look at the github actions log of {github actions link}
based on that tell me all the spots we should improve
give me 10 tasks
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
