
---

## `agents.md`

```md
# AI Working Agreement — Project Rules & Constraints

This file defines **non-negotiable rules** for AI-assisted development in this repository.
If anything is ambiguous, **ASK QUESTIONS FIRST**. Do not guess.

---

## 0) Prime Directive

**When in doubt, ask.**
The project owner prefers answering questions over receiving unwanted assumptions.

---

## 1) Non-Negotiables

### Language
- All **code** and **code comments** must be written in **English**.
- Documentation (Markdown) can be Spanish or English, but keep it clear and consistent.

### Package Manager
- Use **pnpm exclusively**.
  - ✅ `pnpm install`
  - ✅ `pnpm run dev`
  - ✅ `pnpm test`
  - ❌ `npm`, `yarn`, `bun`

### Architecture
- Follow **Clean Architecture (light)** and enforce boundaries.
- Do not introduce cross-layer imports that break dependency direction.
- Prefer explicit interfaces/ports for infrastructure dependencies.

### Security by Design
- Treat security as a default requirement.
- Follow OWASP Top 10 mindset:
  - access control is enforced on the server
  - validate input at boundaries
  - avoid injection risks
  - protect auth flows
  - log/monitor meaningful security events without leaking secrets

### Responsive UI
- Every UI feature must be **responsive** (desktop + mobile).
- Avoid "desktop-only" layouts.

### Quality Gate
- Keep ESLint/Prettier/a11y rules passing.
- Add/update tests for core behaviors.
- Do not introduce new libraries without justification and approval.

---

## 2) Project Goals (Product)

Build an app where authenticated users can:
- Access a dashboard and calendar views.
- Create/edit tasks and notes.
- Navigate tasks by day via a **right-side day list** (expandable).
- Schedule task reminders processed asynchronously (BullMQ/Redis worker).

---

## 3) Clean Architecture Boundaries (Practical Rules)

### Dependency direction
- `domain` must not depend on `application` or `infrastructure`.
- `application` can depend on `domain`, but not on concrete infrastructure.
- `infrastructure` depends on `application` + `domain` and provides implementations.

### Allowed imports (example)
- domain → domain only
- application → domain + application
- infrastructure → everything (but infrastructure-only details stay contained)

### Configuration
- Only the infrastructure/config layer may read `process.env`.
- Environment variables must be validated at startup (Zod recommended).
- Never hardcode secrets.

---

## 4) Frontend Rules (Next.js + React)

### Rendering model
- Default to Server Components in the App Router.
- Use `"use client"` only when needed (state, effects, DOM measurement, animations, event handlers).
- For heavy/DOM-dependent components, consider `dynamic(..., { ssr: false })` if appropriate.

### Styling and UI
- Tailwind CSS.
- Prefer composable components (small, reusable).
- Accessibility: semantic HTML, labels, aria where needed, keyboard support.
- Responsive-first:
  - Mobile layout must be defined (not an afterthought).
  - The right sidebar day-list must adapt to mobile (e.g., collapsible, drawer, below content).

### State & data
- Keep business rules out of UI components where possible.
- Define shared types for tasks/notes/reminders (and avoid duplicating shapes).
- Avoid prop drilling for large trees; prefer feature-level composition.

---

## 5) Authentication Rules (Two JWT Tokens)

Implement auth with:
- **Access token**: short TTL
- **Refresh token**: long TTL, rotation recommended

Storage guidelines (default preference):
- Use **httpOnly cookies** for tokens (mitigates XSS token theft).
- Use secure cookie attributes in production (`Secure`, `SameSite`, `HttpOnly`).
- Enforce server-side authorization checks on every protected resource.

Password policy:
- Strong passwords required (length + complexity, no trivial passwords).
- Rate limiting and brute-force protections for login.

If any security tradeoff is unclear, ask before implementing.

---

## 6) Worker / Reminders Rules (BullMQ)

- Reminder scheduling must be reliable and idempotent.
- Jobs should include a stable identifier to avoid duplicates.
- Failures must be observable (Sentry logging / structured logs).
- Do not block API requests with long-running tasks; enqueue work instead.

---

## 7) Testing Policy (TDD-Friendly)

### Test Stack
- **Vitest**: Fast test runner with native TypeScript support
- **Testing Library**: React testing utilities (behavior-focused)
- **jsdom**: Browser environment for component tests
- **Playwright**: E2E tests for critical flows

### Commands
```bash
pnpm test           # Watch mode (interactive development)
pnpm test:run       # Single run (CI/CD)
pnpm test:coverage  # With coverage report
```

### Preferred workflow
- TDD when feasible: red → green → refactor.
- Tests are required for core logic and critical user flows.
- Write tests BEFORE implementing features.

### Testing layers
- **Unit**: domain logic / pure functions / utilities
- **Component**: React components with Testing Library (focus on user behavior)
- **Integration**: use cases + repository adapters (test DB when needed)
- **E2E**: Playwright for critical flows (auth + calendar operations + reminders)

### Test file naming
- Unit/Component tests: `*.test.ts` or `*.test.tsx` (colocated with source)
- Integration tests: `src/__tests__/*.test.ts`
- E2E tests: `e2e/*.spec.ts` (when Playwright is configured)

### Coverage policy (strategic)
- 100% for core business rules and auth/access control paths.
- High coverage for scheduling/reminder logic.
- Lower priority for glue code/wiring.

### Best practices
- Test behavior, not implementation details.
- Use `screen.getByRole`, `getByLabelText` over `getByTestId`.
- Avoid testing internal state; test what the user sees.
- Mock external dependencies (API calls, timers) when needed.

### Avoid
- Overusing snapshots for meaningful UI logic.
- Flaky E2E: use stable selectors and deterministic test data.
- Testing implementation details (internal state, private methods).

---

## 8) Performance & UX Rules

- Favor perceived performance:
  - skeleton loading
  - progressive rendering
  - optimistic updates when safe
- Avoid unnecessary re-renders and heavy client bundles.
- Large lists should be handled efficiently (pagination/virtualization if needed).

---

## 9) Observability (Sentry)

- Add Sentry instrumentation where relevant (web/api/worker).
- Capture errors with context, but never include secrets or tokens in logs.
- Monitor job failures in the worker.

---

## 10) Documentation Rules (Docs-as-Code)

- Update docs in the **same PR** when behavior/API changes.
- APIs must be documented with OpenAPI/Swagger.
- Architectural decisions must be recorded as ADRs when they affect future evolution.

---

## 11) Git & PR Workflow

- Every change must be submitted via Pull Request.
- Keep PRs small and focused.
- Include:
  - what changed
  - why
  - how to test
  - screenshots/video for UI changes (if possible)
  - security considerations for auth/data features

Commit message guideline:
- `feat: ...`, `fix: ...`, `chore: ...`, `test: ...`, `docs: ...`

---

## 12) Definition of Done (per feature)

A feature is done when:
- It matches requirements and is responsive.
- Security and access control are enforced server-side.
- Lint + typecheck pass.
- Tests are added/updated (unit/integration and/or E2E as applicable).
- Docs are updated if needed.
- No secrets are introduced.
- PR is ready to review.

---

## 13) If You Need Clarification

Ask concise questions about:
- Data model (task fields, note linking, reminder rules)
- Mobile behavior of calendar/day sidebar
- Token storage strategy (cookies vs alternatives)
- API shape and naming conventions
- Whether a feature is MVP vs post-MVP
