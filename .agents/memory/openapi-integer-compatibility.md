---
name: OpenAPI integer compatibility
description: Compatibility constraint between the workspace OpenAPI generator and its current Zod runtime.
---

When adding numeric API fields, verify the generated Zod output against the workspace's installed Zod version. In this workspace, OpenAPI `integer` fields generated `zod.int()`, but the installed Zod 3.x package did not expose that helper; using `number` in the contract avoided a codegen typecheck failure.

**Why:** Codegen completed successfully but the chained library typecheck failed after generation, so the mismatch is easy to miss if only Orval output is checked.

**How to apply:** After every OpenAPI change, run the full codegen command and `pnpm run typecheck:libs` before relying on the generated client or server schemas.