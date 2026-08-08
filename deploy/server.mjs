// Hostinger entry point — imports the pre-built bundle from the same folder.
// server.bundle.mjs is the esbuild output of artifacts/api-server/src/index.ts
// and contains all dependencies inlined — no node_modules required at runtime.
import "./server.bundle.mjs";
