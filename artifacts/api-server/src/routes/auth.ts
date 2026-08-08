/**
 * Authentication routes — email/password with JWT.
 *
 * POST /auth/register  → create account, return token + user
 * POST /auth/login     → verify credentials, return token + user
 * GET  /auth/me        → return current user from JWT
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function jwtSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET env var is not set");
  return s;
}

function signToken(payload: {
  userId: string;
  email: string;
  name: string;
  role: string;
}): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "7d" });
}

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, role = "customer" } = req.body ?? {};

    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email, and password are required" });
      return;
    }
    if (typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    if (!["customer", "merchant"].includes(role)) {
      res.status(400).json({ error: "role must be 'customer' or 'merchant'" });
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = randomUUID();

    await db.insert(usersTable).values({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      name: String(name).trim(),
      role,
    });

    const token = signToken({
      userId,
      email: normalizedEmail,
      name: String(name).trim(),
      role,
    });

    res.status(201).json({
      token,
      user: { id: userId, email: normalizedEmail, name: String(name).trim(), role },
    });
  } catch (err) {
    console.error("[auth] register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("[auth] login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
router.get("/auth/me", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, jwtSecret()) as {
      userId: string;
      email: string;
      name: string;
      role: string;
    };

    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;
