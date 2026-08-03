import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

// ---------------------------------------------------------------------------
// Security headers (helmet sets X-Frame-Options, X-Content-Type-Options,
// Strict-Transport-Security, Content-Security-Policy, etc.)
// ---------------------------------------------------------------------------
app.use(
  helmet({
    // CSP is managed by the frontend CDN; disable it here so the API does not
    // accidentally break browser navigation with a server-side policy.
    contentSecurityPolicy: false,
  }),
);

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
// General limit: 300 req / 15 min per IP (covers all /api/* routes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Strict limit: 20 req / 15 min per IP (financial write endpoints)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests on this endpoint, please try again later." },
});

app.use(pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Apply rate limiters — general first, strict on sensitive endpoints.
// Must come after body parsers so limits are correctly attributed per IP.
app.use("/api", generalLimiter);
app.use("/api/checkout", strictLimiter);
app.use("/api/wallet/withdraw", strictLimiter);
app.use("/api/gift-cards", strictLimiter);
app.use("/api/group-buys", strictLimiter);

app.use("/api", router);

export default app;
