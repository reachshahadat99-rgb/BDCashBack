import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthContext } from "@/contexts/AuthContext";
import { Wallet as WalletIcon } from "lucide-react";

export function SignInForm({ redirectUrl = "/" }: { redirectUrl?: string }) {
  const { login } = useAuthContext();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLocation(redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-2 flex flex-col items-center">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
          <WalletIcon className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">Welcome back</h2>
        <p className="text-sm text-slate-500 mt-1 text-center">
          Sign in to your BDCashBack account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">
            Email address
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-slate-700">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 focus:outline-none disabled:opacity-50 transition-colors"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup/customer" className="font-semibold text-teal-700 hover:underline">
            Sign up free
          </Link>
        </p>
      </form>
    </div>
  );
}
