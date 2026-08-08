/**
 * Admin Payment Gateway Settings routes
 * GET  /admin/payment-settings        — list all gateways (secrets masked)
 * PATCH /admin/payment-settings/:id   — update config (writes audit_log)
 *
 * Secrets are stored AES-256-CBC encrypted and NEVER returned in plaintext.
 */
import { Router, type IRouter } from "express";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, paymentGatewaySettingsTable, auditLogsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

function getEncKey(): Buffer {
  const raw = process.env.PAYMENT_ENCRYPTION_KEY;
  if (!raw) throw new Error("PAYMENT_ENCRYPTION_KEY env var is required but not set");
  return Buffer.from(raw.padEnd(32, "0").slice(0, 32));
}

function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const key = getEncKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + enc.toString("hex");
}

function lastFour(s: string): string {
  if (!s) return "";
  return s.length <= 4 ? "••••" : "••••" + s.slice(-4);
}

// ---------------------------------------------------------------------------
// Seed helper — ensures all known gateways exist in the DB
// ---------------------------------------------------------------------------

const DEFAULT_GATEWAYS = [
  { id: "sslcommerz", gatewayName: "SSLCommerz" },
  { id: "bkash", gatewayName: "bKash" },
  { id: "nagad", gatewayName: "Nagad" },
  { id: "rocket", gatewayName: "Rocket (DBBL)" },
];

let seeded = false;
async function ensureGatewaysSeeded() {
  if (seeded) return;
  for (const gw of DEFAULT_GATEWAYS) {
    await db
      .insert(paymentGatewaySettingsTable)
      .values({ ...gw })
      .onConflictDoNothing();
  }
  seeded = true;
}

// ---------------------------------------------------------------------------
// View helper — mask secret key
// ---------------------------------------------------------------------------
function gatewayView(row: typeof paymentGatewaySettingsTable.$inferSelect) {
  return {
    id: row.id,
    gatewayName: row.gatewayName,
    enabled: row.enabled,
    mode: row.mode,
    merchantId: row.merchantId,
    secretKeyMasked: row.secretKeyLastFour ? "••••" + row.secretKeyLastFour : "",
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/admin/payment-settings", requireAdmin, async (_req, res): Promise<void> => {
  await ensureGatewaysSeeded();
  const rows = await db.select().from(paymentGatewaySettingsTable);
  const ordered = DEFAULT_GATEWAYS.map((g) => rows.find((r) => r.id === g.id)).filter(Boolean) as typeof rows;
  res.json(ordered.map(gatewayView));
});

router.patch("/admin/payment-settings/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  if (!id) { res.status(400).json({ error: "Gateway ID required" }); return; }

  const { enabled, mode, merchantId, secretKey } = req.body as {
    enabled?: boolean;
    mode?: "sandbox" | "live";
    merchantId?: string;
    secretKey?: string; // only sent when explicitly changing the secret
  };

  const patch: Partial<typeof paymentGatewaySettingsTable.$inferInsert> = {
    updatedBy: res.locals.userId as string,
    updatedAt: new Date(),
  };
  if (typeof enabled === "boolean") patch.enabled = enabled;
  if (mode === "sandbox" || mode === "live") patch.mode = mode;
  if (typeof merchantId === "string") patch.merchantId = merchantId.trim();
  if (typeof secretKey === "string" && secretKey.trim()) {
    if (!process.env.PAYMENT_ENCRYPTION_KEY) {
      res.status(503).json({ error: "Payment secret encryption is not configured on this server" });
      return;
    }
    const trimmed = secretKey.trim();
    patch.secretKeyEncrypted = encrypt(trimmed);
    patch.secretKeyLastFour = trimmed.slice(-4);
  }

  const [updated] = await db
    .update(paymentGatewaySettingsTable)
    .set(patch)
    .where(eq(paymentGatewaySettingsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Gateway not found" }); return; }

  // Write audit log — never include secret key value
  await db.insert(auditLogsTable).values({
    id: nanoid(),
    adminUserId: res.locals.userId as string,
    action: "payment_settings.update",
    targetType: "payment_gateway",
    targetId: id,
    details: JSON.stringify({
      enabled: patch.enabled,
      mode: patch.mode,
      merchantId: patch.merchantId,
      secretChanged: Boolean(secretKey?.trim()),
    }),
  });

  res.json(gatewayView(updated));
});

export default router;
