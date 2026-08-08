import { useState } from "react";
import {
  useListOrders,
  useGetOrder,
  useCancelOrder,
  getListOrdersQueryKey,
  getGetOrderQueryKey,
} from "@workspace/api-client-react";
import type { CustomerOrder } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, fmtDate } from "@/lib/utils";
import {
  ShoppingBag,
  ChevronRight,
  AlertCircle,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Tag,
  RotateCcw,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type StatusMeta = { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode };

function statusMeta(status: string): StatusMeta {
  switch (status) {
    case "pending_payment":
      return { label: "Pending Payment", variant: "secondary", icon: <Clock className="w-3 h-3" /> };
    case "paid":
      return { label: "Paid", variant: "secondary", icon: <Clock className="w-3 h-3" /> };
    case "processing":
      return { label: "Processing", variant: "default", icon: <Package className="w-3 h-3" /> };
    case "shipped":
      return { label: "Shipped", variant: "default", icon: <Truck className="w-3 h-3" /> };
    case "delivered":
      return { label: "Delivered", variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> };
    case "completed":
      return { label: "Completed", variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> };
    case "cancelled":
      return { label: "Cancelled", variant: "destructive", icon: <XCircle className="w-3 h-3" /> };
    default:
      return { label: status, variant: "outline", icon: <RotateCcw className="w-3 h-3" /> };
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "pending_payment": return "bg-amber-50 text-amber-700 border-amber-200";
    case "paid":         return "bg-amber-50 text-amber-700 border-amber-200";
    case "processing":   return "bg-blue-50 text-blue-700 border-blue-200";
    case "shipped":      return "bg-violet-50 text-violet-700 border-violet-200";
    case "delivered":    return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "completed":    return "bg-teal-50 text-teal-700 border-teal-200";
    case "cancelled":    return "bg-rose-50 text-rose-700 border-rose-200";
    default:             return "bg-muted text-muted-foreground border-border";
  }
}

// ---------------------------------------------------------------------------
// Order Detail Dialog
// ---------------------------------------------------------------------------

const CANCELLABLE_STATUSES = ["pending_payment", "paid", "processing"];

function OrderDetailDialog({ orderId, open, onClose }: { orderId: string; open: boolean; onClose: () => void }) {
  const { isSignedIn } = useAuth();
  const { data: order, isLoading, isError } = useGetOrder(orderId, {
    query: {
      enabled: open && !!isSignedIn && !!orderId,
      queryKey: getGetOrderQueryKey(orderId),
    },
  });

  const queryClient = useQueryClient();
  const cancel = useCancelOrder();
  const [cancelError, setCancelError] = useState<string | null>(null);

  function handleCancel() {
    setCancelError(null);
    cancel.mutate({ id: orderId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        onClose();
      },
      onError: (err: unknown) => {
        const msg =
          err && typeof err === "object" && "error" in err
            ? String((err as { error: unknown }).error)
            : "Could not cancel the order. Please try again.";
        setCancelError(msg);
      },
    });
  }

  const meta = order ? statusMeta(order.status) : null;
  const canCancel = order && CANCELLABLE_STATUSES.includes(order.status);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Order Details
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-60" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 text-destructive py-6 justify-center">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Failed to load order details.</span>
          </div>
        )}

        {order && meta && (
          <div className="space-y-5">
            {/* Header row */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(-10).toUpperCase()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(order.createdAt)}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeClass(order.status)}`}>
                {meta.icon}
                {meta.label}
              </span>
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Items</p>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(item.price * item.quantity)}</p>
                      {item.cashbackAmount > 0 && (
                        <p className="text-xs text-teal-600 font-medium">+{formatCurrency(item.cashbackAmount)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border">
              {order.couponCode && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Tag className="w-3.5 h-3.5" /> Coupon <span className="font-mono text-xs">{order.couponCode}</span>
                  </span>
                  <span className="text-sm font-semibold text-rose-600">−{formatCurrency(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-semibold">Total Paid</span>
                <span className="text-sm font-bold">{formatCurrency(order.total)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 bg-teal-50/50 rounded-b-xl">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                  <Sparkles className="w-3.5 h-3.5" /> Cashback Earned
                </span>
                <span className="text-sm font-bold text-teal-700">+{formatCurrency(order.cashbackAmount)}</span>
              </div>
            </div>

            {/* Timeline notes */}
            {order.deliveredAt && (
              <p className="text-xs text-muted-foreground">
                Delivered: {fmtDate(order.deliveredAt)}
              </p>
            )}
            {order.completedAt && (
              <p className="text-xs text-muted-foreground">
                Completed: {fmtDate(order.completedAt)}
              </p>
            )}

            {/* Cancel */}
            {canCancel && (
              <div className="space-y-2">
                {cancelError && (
                  <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {cancelError}
                  </div>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleCancel}
                  disabled={cancel.isPending}
                >
                  {cancel.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Cancel Order
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Order Card
// ---------------------------------------------------------------------------

function OrderCard({ order, onClick }: { order: CustomerOrder; onClick: () => void }) {
  const meta = statusMeta(order.status);
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-card hover:shadow-md hover:border-primary/30 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(-10).toUpperCase()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeClass(order.status)}`}>
            {meta.icon}
            {meta.label}
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Items</span>
          <p className="font-semibold">{order.itemsCount}</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div>
          <span className="text-muted-foreground text-xs">Total</span>
          <p className="font-bold">{formatCurrency(order.total)}</p>
        </div>
        {order.cashbackAmount > 0 && (
          <>
            <div className="w-px h-8 bg-border" />
            <div>
              <span className="text-muted-foreground text-xs">Cashback</span>
              <p className="font-bold text-teal-600">+{formatCurrency(order.cashbackAmount)}</p>
            </div>
          </>
        )}
        {order.couponCode && (
          <>
            <div className="w-px h-8 bg-border" />
            <div>
              <span className="text-muted-foreground text-xs">Coupon</span>
              <p className="font-medium text-xs font-mono">{order.couponCode}</p>
            </div>
          </>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function OrderSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-4 mt-1">
        <Skeleton className="h-10 w-14" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Orders() {
  const { isLoaded, isSignedIn } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: orders, isLoading, isError, refetch } = useListOrders({
    query: { enabled: isLoaded && !!isSignedIn, queryKey: getListOrdersQueryKey() },
  });

  // Auth gate
  if (isLoaded && !isSignedIn) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your orders are waiting</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to view your full order history and track deliveries.
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

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-6 md:py-10">
        {/* Page header */}
        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h1 className="text-3xl font-extrabold tracking-tight">Order History</h1>
          <p className="mt-1 text-muted-foreground text-sm">Track all your purchases and cashback earnings.</p>
        </div>

        {/* Error state */}
        {isError && (
          <Card className="rounded-2xl border-destructive/30 bg-destructive/5 mb-4 animate-in fade-in duration-300">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">Failed to load orders.</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Skeleton */}
        {(isLoading || !isLoaded) && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {[0, 1, 2, 3].map((i) => <OrderSkeleton key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && isLoaded && orders?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
              <ShoppingBag className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">No orders yet</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              Your orders will appear here after checkout. Start shopping to earn cashback on every purchase.
            </p>
            <Link
              href="/products"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              Start Shopping
            </Link>
          </div>
        )}

        {/* Order list */}
        {!isLoading && orders && orders.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => setSelectedId(order.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <OrderDetailDialog
        orderId={selectedId ?? ""}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
