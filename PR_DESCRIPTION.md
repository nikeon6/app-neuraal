## feat(topics): TopicsSection with CRUD and reusable ConfirmDialog

### What changed
- **TopicsSection**: New feature section for managing user topics (pills list, create, delete).
- **TopicPill** & **CreateTopicDialog**: Extracted to separate components under `features/topics/components/`.
- **ConfirmDialog**: Reusable confirmation dialog in `shared/ui` with full a11y (role=alertdialog, focus management, Escape/backdrop).
- **Store**: Topics state and actions (`addTopic`, `removeTopic`) in Zustand with validation (trim, case-insensitive duplicates).
- **Dashboard**: Renders `TopicsSection` when section "Topics" is selected.

### Why
- Centralize topic management in the app.
- Reuse confirmation pattern across features via `ConfirmDialog`.
- Keep components small and testable.

### How to test
1. Go to Dashboard → Topics tab.
2. Click "Add topic", enter name + color, Create → pill appears.
3. Try duplicate name (same/trimmed) → error and Create disabled.
4. Click delete on a pill → confirm dialog with topic name → Confirm removes pill, Cancel keeps it.
5. Run tests: `pnpm test:run -- src/features/topics/components/TopicsSection.test.tsx` (46 tests).

### Checklist
- [x] Responsive (existing layout preserved).
- [x] No new dependencies.
- [x] RTL tests pass; roles/aria-labels/data-testid unchanged.
- [x] ConfirmDialog exported from `@/shared/ui`.
