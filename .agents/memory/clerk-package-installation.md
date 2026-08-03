---
name: Clerk package installation
description: Workspace-specific dependency installation rule for Clerk authentication.
---

Install Clerk client dependencies with the storefront package filter and Clerk server dependencies with the API-server package filter. The generic language-package installer targets the monorepo root and stops at pnpm's workspace-root guard.

**Why:** Authentication setup succeeded, but the first package-install attempt failed because it tried to add all dependencies to the workspace root instead of the two owning packages.

**How to apply:** Use package-scoped pnpm commands for future auth changes: the web artifact owns `@clerk/react` and `@clerk/themes`; the API artifact owns `@clerk/express`, `@clerk/shared`, and `http-proxy-middleware`.