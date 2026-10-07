# Phase 1: Interview

Reach a shared understanding of the problem before writing the spec. The goal is to
remove ambiguity, not to fill a questionnaire.

## How to run it

- Create the PRD folder and `spec.md` from the template first, with `phase: interview`,
  so notes are saved as you go and survive the session.
- Ask **one question at a time** and wait for the answer. Never send a list of questions.
- Before each question, check the codebase and docs: do not ask what the repo answers.
- Prefer concrete questions with options and your recommendation:
  "Should the retry live in the client or in the queue consumer? I'd put it in the
  consumer because X; the client option costs Y."
- When an answer opens a new branch (an edge case, a dependency), follow it before
  moving on.
- Push back when an answer conflicts with something said earlier or with the codebase.

## What to cover

Go through these areas, in whatever order the conversation makes natural:

| Area | You are done when you know |
|---|---|
| Problem | Who is affected, what happens today, why now |
| Outcome | How the user will know it worked (measurable when possible) |
| Scope | What is in, and what is explicitly out |
| Constraints | Deadlines, compatibility, performance, security, cost |
| Approach | The main options and which one the user prefers, with why |
| Risks | What could go wrong and what would be the fallback |
| Dependencies | Other teams, services, PRDs or decisions this waits on |

## When to stop

Stop when you could explain the work to someone else without guessing, and every open
point is either decided or listed as an open question. There is no fixed number of
questions. If the user says "enough", stop and list what is still open.

## Output

In `spec.md`:

- **Interview notes**: a short summary per area, in the user's terms.
- **Decisions** table: one row per decision taken during the interview, with the
  alternatives considered and the rationale.
- **Open questions**: anything still undecided.

Then run the checkpoint from SKILL.md.
