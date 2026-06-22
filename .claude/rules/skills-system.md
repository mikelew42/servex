---
trigger: always_on
---

# Skills System

Skills are on-demand instruction files stored in `.claude/skills/<name>/SKILL.md`. They reduce context bloat by keeping a minimal footprint in every session: only the skill's `name` and `description` are always loaded. The full instructions load only when the skill is invoked — either manually via `/name` or automatically when Claude determines the skill is relevant based on its description.

This is the primary mechanism for project-specific knowledge in this codebase. Prefer skills over inline instructions for anything reusable or domain-specific.

## File Structure

```
.claude/
  skills/
    <skill-name>/
      SKILL.md          # required
      references/       # optional supporting files
      scripts/          # optional helper scripts
  rules/
    <rule-name>.md      # always-on or path-scoped rules
```

### SKILL.md format

```markdown
---
name: skill-name
description: What this skill does and when to use it. This is the only part
             always in context — make it precise so autonomous invocation fires
             at the right moment and not at the wrong one.
---

Full instructions here...
```

The `description` is the most important field. It should answer: **what does this do, and when should it fire?** Bad descriptions cause missed invocations or false triggers.

## Current Skills

- **view-guide** — How to write UI with the Lew42/View framework (element helpers, captor pattern, chaining API). Fires when writing page.js files or View components.

## Self-Improvement Directives

You must actively help this skills system grow and stay accurate:

**Suggest improvements** when you notice a skill's instructions are incomplete, wrong, or missing an important case. Say so concisely at the end of your response: _"The view-guide skill doesn't cover X — worth adding?"_

**Suggest new skills** when you find yourself explaining the same project-specific concept more than once, or when a task requires knowledge that isn't captured anywhere. Good candidates: recurring patterns, non-obvious conventions, system integrations, workflow steps.

**Flag stale skills** if a skill's instructions contradict what you observe in the actual code. Skills rot when code changes; surfacing that is part of your job.

When suggesting a new skill, provide a draft `description` field so the invocation trigger is clear from the start.
