import { useUser, useAuth } from "@clerk/react";
import { useListOrders, useGetWalletSummary, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, fmtDate } from "@/lib/utils";
import {
  User,
  ShoppingBag,
  Wallet,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Clock,
  BadgeCheck,
  Mail,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="rounded-2xl border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-extrabold leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Quick action row
// ---------------------------------------------------------------------------

function ActionRow({ href, icon, label, sub }: { href: string; icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent rounded-xl transition-colors cursor-pointer group">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary group-hover:bg-primary/10">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Account() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const { data: orders, isLoading: ordersLoading } = useListOrders({
    query: { enabled: isLoaded && !!isSignedIn, queryKey: getListOrdersQueryKey() },
  });

  const { data: wallet, isLoading: walletLoading } = useGetWalletSummary({
    query: { enabled: isLoaded && !!isSignedIn, queryKey: ["/api/wallet/summary", isSignedIn] },
  });

  // Auth gate
  if (isLoaded && !isSignedIn) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <User className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your account awaits</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to manage your profile, view order history, and track your cashback earnings.
          </p>
          <Link
            href="/sign-in"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const completedOrders = orders?.filter((o) => o.status === "completed").length ?? 0;
  const totalOrders = orders?.length ?? 0;
  const totalCashbackEarned = orders?.reduce((sum, o) => sum + (o.cashbackAmount ?? 0), 0) ?? 0;

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress ?? "Customer";

  const initials = (user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "U").toUpperCase();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const memberSince = user?.createdAt ? fmtDate(new Date(user.createdAt).toISOString()) : null;

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-6 md:py-10 space-y-6">

        {/* Profile hero */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-accent/60 to-background border border-border p-6 flex items-center gap-5">
            {/* Avatar */}
            {!isLoaded ? (
              <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-extrabold shadow-lg">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {!isLoaded ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-52" />
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-extrabold tracking-tight truncate">{displayName}</h1>
                  {email && (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5 truncate">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      {email}
                    </p>
                  )}
                  {memberSince && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-teal-600" />
                      Member since {memberSince}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-75">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Overview</h2>
          <div className="grid grid-cols-2 gap-3">
            {ordersLoading ? (
              <>
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </>
            ) : (
              <>
                <StatCard
                  label="Total Orders"
                  value={String(totalOrders)}
                  sub={completedOrders > 0 ? `${completedOrders} completed` : undefined}
                  icon={<ShoppingBag className="w-5 h-5 text-blue-600" />}
                  color="bg-blue-50"
                />
                <StatCard
                  label="Cashback Earned"
                  value={formatCurrency(totalCashbackEarned)}
                  sub="across all orders"
                  icon={<Sparkles className="w-5 h-5 text-teal-600" />}
                  color="bg-teal-50"
                />
              </>
            )}

            {walletLoading ? (
              <>
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </>
            ) : (
              <>
                <StatCard
                  label="Wallet Balance"
                  value={formatCurrency(wallet?.balance ?? 0)}
                  sub="available to withdraw"
                  icon={<Wallet className="w-5 h-5 text-violet-600" />}
                  color="bg-violet-50"
                />
                <StatCard
                  label="Pending Cashback"
                  value={formatCurrency(wallet?.pendingCashback ?? 0)}
                  sub="releases after delivery"
                  icon={<Clock className="w-5 h-5 text-amber-600" />}
                  color="bg-amber-50"
                />
              </>
            )}
          </div>
        </div>

        {/* Recent orders preview */}
        {!ordersLoading && orders && orders.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Orders</h2>
              <Link href="/orders" className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border bg-card">
              {orders.slice(0, 3).map((order) => (
                <Link key={order.id} href="/orders">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-accent transition-colors cursor-pointer">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">#{order.id.slice(-8).toUpperCase()}</p>
                      <p className="text-sm font-semibold">{formatCurrency(order.total)}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.status === "completed" ? (
                        <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      ) : order.status === "cancelled" ? (
                        <CheckCircle2 className="w-4 h-4 text-rose-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500" />
                      )}
                      <span className="text-xs font-semibold capitalize text-muted-foreground">{order.status}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 delay-150">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Account</h2>
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            <ActionRow
              href="/orders"
              icon={<ShoppingBag className="w-4 h-4" />}
              label="Order History"
              sub="Track and manage your purchases"
            />
            <ActionRow
              href="/wallet"
              icon={<Wallet className="w-4 h-4" />}
              label="Wallet & Cashback"
              sub="View balance and request withdrawals"
            />
            <ActionRow
              href="/profile"
              icon={<ExternalLink className="w-4 h-4" />}
              label="Profile Settings"
              sub="Name, email, password, and security"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
