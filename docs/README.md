# Documentation

Start here. Docs are updated in the same commit as the code they describe — if
behaviour changed and no doc did, the change is incomplete.

| Doc                                                       | What it covers                                                           | Kind          |
| --------------------------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| [00 — Engineering standards](00-engineering-standards.md) | The working agreement, as given. `02`–`08` apply it to this codebase     | **Source**    |
| [01 — Functional spec](01-functional-spec.md)             | What the app does, and the **glossary** that names everything            | Living        |
| [02 — Architecture](02-architecture.md)                   | Vertical slices, DDD, boundaries, authorization point, data-as-code      | Living        |
| [03 — Data model](03-datamodel.md)                        | Tables, constraints, branded types, edge validation                      | Living        |
| [04 — Testing](04-testing.md)                             | Test diamond, pglite, RLS adversarial tests, coverage policy             | Living        |
| [05 — Code quality](05-code-quality.md)                   | The ten rules, TypeScript config, Storybook, `validate`, git conventions | Living        |
| [06 — Security](06-security.md)                           | Auth, RLS consequences, secrets, GDPR and retention                      | Living        |
| [07 — Design system](07-design-system.md)                 | Colour and type tokens from the design canvas, card variants             | Living        |
| [08 — Deployment](08-deployment.md)                       | Environments, migrations, EAS, CI                                        | Living        |
| [09 — Design handoff](09-design-handoff.md)               | Brief given to Claude Design, plus round-2 feedback                      | Living        |
| [ADRs](adr/README.md)                                     | Why we chose what we chose                                               | **Immutable** |
| [Plans](plans/)                                           | Implementation plans and progress                                        | Living        |

## The glossary is the contract

`01-functional-spec.md` holds the ubiquitous language. Those terms appear
verbatim in types, file names, database columns, tests and commit scopes. A
concept that needs a name gets added there before it gets written in code.

## Definition of done

- Implemented following `05-code-quality.md`
- Tests exist and pass, weighted per `04-testing.md`
- Storybook stories for new reusable UI components
- Format, lint, type-check and duplication checks pass
- Docs updated in the same commit
- The increment is runnable and the system works
- Errors handled; nothing swallowed
- Accessibility verified for UI changes — keyboard, labels, contrast
- No `--no-verify`; `validate` passed locally before pushing
