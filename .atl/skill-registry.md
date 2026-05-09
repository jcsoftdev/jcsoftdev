# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| When writing Go tests, using teatest, or adding test coverage | go-testing | ~/.claude/skills/go-testing/SKILL.md |
| When user asks to create a new skill, add agent instructions, or document patterns for AI | skill-creator | ~/.claude/skills/skill-creator/SKILL.md |
| When creating a pull request, opening a PR, or preparing changes for review | branch-pr | ~/.claude/skills/branch-pr/SKILL.md |
| When creating a GitHub issue, reporting a bug, or requesting a feature | issue-creation | ~/.claude/skills/issue-creation/SKILL.md |
| When user says "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen" | judgment-day | ~/.claude/skills/judgment-day/SKILL.md |
| When user says "caveman mode", "talk like caveman", "use caveman", "less tokens", "be brief", or invokes /caveman | caveman | ~/.claude/plugins/cache/caveman/caveman/63e797cd753b/skills/caveman/SKILL.md |
| When user says "review this PR", "code review", "review the diff", "/review", or invokes /caveman-review | caveman-review | ~/.claude/plugins/cache/caveman/caveman/63e797cd753b/skills/caveman-review/SKILL.md |
| When user says "write a commit", "commit message", "generate commit", "/commit", or invokes /caveman-commit | caveman-commit | ~/.claude/plugins/cache/caveman/caveman/63e797cd753b/skills/caveman-commit/SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### go-testing
- Use table-driven tests for all multi-case scenarios: `tests := []struct{ name, input, expected string; wantErr bool }{...}`
- Test Bubbletea model state changes by calling `m.Update(msg)` directly — no full TUI needed
- Use `teatest.NewTestModel(t, m)` for full interactive flow tests (sends keys, waits, reads final model)
- Use golden files in `testdata/` for View() rendering tests; update with `-update` flag
- Test both success and error paths for any function that returns an error
- Mock system dependencies via interfaces, not concrete types; use `t.TempDir()` for file ops
- Co-locate `*_test.go` next to source files; integration tests use `t.Skip` on `-short`
- Run: `go test ./...` | `go test -cover ./...` | `go test -run TestName` | `go test -short`

### skill-creator
- Skill lives at `skills/{skill-name}/SKILL.md` — always this exact path
- Frontmatter required: `name`, `description` (includes Trigger sentence), `license: Apache-2.0`, `metadata.author: gentleman-programming`, `metadata.version`
- Description field MUST contain "Trigger:" clause — that's how the registry auto-detects when to load
- `assets/` for templates/schemas/examples; `references/` for LOCAL doc paths only (no web URLs)
- After creating, register in `AGENTS.md` table
- Never create a skill for one-off tasks or things already in existing docs
- Keep Critical Patterns section at top — that's what sub-agents actually need
- No Keywords section — agent reads frontmatter, not body keywords

### branch-pr
- Every PR MUST link an approved issue: `Closes #N` in body (or Fixes/Resolves)
- Branch naming: `type/description` matching `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$`
- Every PR MUST have exactly one `type:*` label — add via `gh pr edit <n> --add-label "type:feature"`
- Commit format: `type(scope): description` — conventional commits, no AI attribution trailers
- Run `shellcheck scripts/*.sh` before pushing any script changes
- Linked issue MUST have `status:approved` label before PR opens — automated check will block otherwise
- PR body sections required: linked issue, PR type checkbox, summary, changes table, test plan, checklist

### issue-creation
- Blank issues disabled — MUST use bug_report.yml or feature_request.yml template
- Bug reports auto-label: `bug`, `status:needs-review`; Feature requests: `enhancement`, `status:needs-review`
- Maintainer MUST add `status:approved` before any PR can reference the issue
- Questions → Discussions, not issues
- Pre-flight checkboxes required in every template: no duplicate + understands approval workflow
- Search existing issues before creating: `gh issue list --search "keyword"`
- Title follows conventional commit format: `fix(scope): description` or `feat(scope): description`

### judgment-day
- Always launch Judge A and Judge B as async parallel delegates — never sequential, never do review yourself
- Both judges get IDENTICAL prompts including injected Project Standards compact rules
- Each judge is blind — neither knows about the other
- Classify every WARNING as real (normal user can trigger) or theoretical (contrived/malicious scenario needed)
- Theoretical WARNINGs → report as INFO only, do NOT fix, do NOT re-judge
- Confirmed = found by BOTH judges; Suspect = one judge only; Contradiction = judges disagree
- Round 1: show verdict table, ASK user before fixing
- Round 2+: only re-judge if confirmed CRITICALs remain; fix real WARNINGs inline without re-judge
- Fix Agent is a separate delegation — never reuse a judge as fixer
- After 2 fix iterations, ASK user whether to continue — never auto-escalate
- NEVER declare APPROVED until 0 confirmed CRITICALs + 0 confirmed real WARNINGs

### caveman
- Active every response until "stop caveman" or "normal mode"
- Default level: full — drop articles, fragments OK, short synonyms
- Levels: lite (no filler, keep grammar) | full (drop articles, fragments) | ultra (abbreviate, arrows for causality)
- Drop: articles, filler words (just/really/basically), pleasantries, hedging
- Keep: technical terms exact, code blocks unchanged, errors quoted exact
- Auto-clarity exceptions: security warnings, irreversible actions, multi-step sequences where fragment order risks misread
- Code/commits/PRs: write normal regardless of caveman level

### caveman-review
- Format: `L<line>: <problem>. <fix>.` or `<file>:L<line>: ...` for multi-file
- Severity prefixes: `🔴 bug:` (broken) | `🟡 risk:` (fragile) | `🔵 nit:` (style) | `❓ q:` (question)
- Drop: "I noticed", "you might want", "great work", restating what the line does, hedging
- Keep: exact line numbers, exact symbol names in backticks, concrete fix, "why" when fix isn't obvious
- Auto-clarity for: CVE-class security findings, architectural disagreements, onboarding contexts
- Does not write code fixes, does not approve/request-changes, does not run linters

### caveman-commit
- Format: `<type>(<scope>): <imperative summary>` — scope optional
- Types: feat|fix|refactor|perf|docs|test|chore|build|ci|style|revert
- Subject ≤50 chars preferred, hard cap 72, no trailing period, imperative mood
- Body only when: non-obvious why, breaking changes, migration notes, linked issues
- Never include: "This commit does X", AI attribution, emoji (unless project requires), restating file name
- Breaking change: `feat(api)!: ...` with `BREAKING CHANGE:` in body

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| (none) | — | Greenfield project — no convention files exist yet. Will populate after bootstrap-architecture. |
