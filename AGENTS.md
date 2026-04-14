# AGENTS.md

Guidance for coding agents (Jules, Claude Code, etc.) working in this repo.

## Dev history wiki

Prior design decisions and SDDs live at https://promptroot.ai/wiki and in
`docs/sdd/*.md`. The markdown files are the source of truth.

### Jules

PromptRoot's Jules queue injects relevant wiki excerpts into your prompt
automatically before submission (see
`docs/sdd/dev-history-wiki.md` § W4.2). Look for a
`## Relevant Prior Design Decisions` section near the top of your prompt.
Do not attempt outbound HTTP requests to fetch additional context; you
cannot reach them, and what matters is already in the prompt.

### Claude Code

A project-scoped skill at `.claude/skills/search-dev-history/SKILL.md` lets
you query the wiki's RAG endpoint directly. Invoke it when prior context
would inform your answer.

### Other agents

Any agent can POST to the `ragQuery` endpoint:

    POST https://us-central1-promptroot-b02a2.cloudfunctions.net/ragQuery
    Content-Type: application/json

    { "query": "<user question>", "topK": 5 }

Returns `{ results: [{ docPath, slug, heading, text, score, url }, ...] }`.
Public docs only.

## Conventions

See `CLAUDE.md` for project structure, testing commands, and coding
conventions that apply to all changes.
