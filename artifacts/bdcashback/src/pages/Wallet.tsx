import { useState } from "react";
import {
  useGetWalletSummary,
  useListWalletTransactions,
  useRequestWithdrawal,
} from "@workspace/api-client-react";
import type { WalletTransaction } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Wallet as WalletIcon,
  Clock,
  ArrowDownToLine,
  History,
  Sparkles,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Banknote,
  CheckCircle2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Transaction icon/label helpers
// ---------------------------------------------------------------------------

function txMeta(type: string): { icon: React.ReactNode; label: string; color: string } {
  switch (type) {
    case "cashback_pending":
      return {
        icon: <Clock className="w-4 h-4" />,
        label: "Cashback Pending",
        color: "text-amber-600",
      };
    case "cashback_released":
      return {
        icon: <TrendingUp className="w-4 h-4" />,
        label: "Cashback Released",
        color: "text-emerald-600",
      };
    case "cashback_reversed":
      return {
        icon: <RotateCcw className="w-4 h-4" />,
        label: "Cashback Reversed",
        color: "text-rose-600",
      };
    case "withdrawal_requested":
      return {
        icon: <TrendingDown className="w-4 h-4" />,
        label: "Withdrawal Requested",
        color: "text-blue-600",
      };
    case "withdrawal_completed":
      return {
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: "Withdrawal Completed",
        color: "text-emerald-600",
      };
    case "withdrawal_failed":
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        label: "Withdrawal Failed",
        color: "text-rose-600",
      };
    default:
      return {
        icon: <Banknote className="w-4 h-4" />,
        label: type.replace(/_/g, " "),
        color: "text-muted-foreground",
      };
  }
}

function txAmountClass(tx: WalletTransaction) {
  return tx.amount >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold";
}

// ---------------------------------------------------------------------------
// Withdraw dialog
// ---------------------------------------------------------------------------

interface WithdrawDialogProps {
  open: boolean;
  onClose: () => void;
  maxAmount: number;
  onSuccess: () => void;
}

function WithdrawDialog({ open, onClose, maxAmount, onSuccess }: WithdrawDialogProps) {
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useRequestWithdrawal();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (numAmount > maxAmount) {
      setError(`Amount exceeds available balance of ${formatCurrency(maxAmount)}.`);
      return;
    }
    if (!bankName.trim()) {
      setError("Bank name is required.");
      return;
    }
    if (!accountNumber.trim()) {
      setError("Account number is required.");
      return;
    }

    mutate(
      { data: { amount: numAmount, bankName: bankName.trim(), accountNumber: accountNumber.trim(), notes: notes.trim() } },
      {
        onSuccess: () => {
          setAmount("");
          setBankName("");
          setAccountNumber("");
          setNotes("");
          onSuccess();
          onClose();
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error ? err.message : "Withdrawal request failed. Please try again.";
          setError(msg);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Cashback</DialogTitle>
          <DialogDescription>
            Transfer your available cashback to your bank account. Available:{" "}
            <span className="font-semibold text-foreground">{formatCurrency(maxAmount)}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (৳)</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              max={maxAmount}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bankName">Bank Name</Label>
            <Input
              id="bankName"
              placeholder="e.g. Dutch-Bangla Bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              placeholder="Your account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || maxAmount <= 0}>
              {isPending ? "Requesting…" : "Request Withdrawal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Wallet() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const { data, isLoading, isError } = useGetWalletSummary({
    query: {
      queryKey: ["/api/wallet/summary", isSignedIn],
      enabled: isLoaded && Boolean(isSignedIn),
    },
  });

  const { data: transactions, isLoading: txLoading } = useListWalletTransactions(
    { limit: 20 },
    {
      query: {
        queryKey: ["/api/wallet/transactions", isSignedIn],
        enabled: isLoaded && Boolean(isSignedIn),
      },
    },
  );

  if (isLoaded && !isSignedIn) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center space-y-5">
        <div className="h-16 w-16 rounded-full bg-accent text-primary flex items-center justify-center">
          <WalletIcon className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Your wallet is private</h1>
        <p className="max-w-md text-muted-foreground">
          Sign in to view your balance, pending cashback, available rewards, and wallet activity.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Sign in to view wallet
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8 space-y-6 animate-in">
        <h1 className="text-3xl font-extrabold tracking-tight mb-6">My Wallet</h1>
        <Skeleton className="w-full h-64 rounded-3xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="w-full h-64 rounded-2xl mt-8" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-2xl font-bold">Could not load wallet details.</h2>
        <Button onClick={() => window.location.reload()} variant="outline">
          Try again
        </Button>
      </div>
    );
  }

  const availableCashback = data.availableCashback ?? 0;

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-8 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground mt-1">Manage your balance and rewards.</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-accent text-primary flex items-center justify-center border-2 border-white shadow-sm">
          <WalletIcon className="w-6 h-6" />
        </div>
      </div>

      {/* Main Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-primary text-white p-8 shadow-lg shadow-primary/20">
        <div className="relative z-10">
          <div className="text-primary-foreground/80 font-medium mb-1">Total Available Balance</div>
          <div className="text-5xl font-black tracking-tight mb-8">{formatCurrency(data.balance)}</div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              className="bg-white text-primary hover:bg-white/90 rounded-xl h-12 px-8 font-bold flex-1 sm:flex-none"
              onClick={() => setWithdrawOpen(true)}
              disabled={availableCashback <= 0}
            >
              <ArrowDownToLine className="w-5 h-5 mr-2" />
              Withdraw
            </Button>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 rounded-xl h-12 px-8 font-semibold flex-1 sm:flex-none"
              onClick={() => setWithdrawOpen(true)}
              disabled={availableCashback <= 0}
            >
              Transfer to Bank
            </Button>
          </div>

          {availableCashback <= 0 && data.pendingCashback > 0 && (
            <p className="text-primary-foreground/70 text-sm mt-4">
              Your cashback will be available after the 30-day return window.
            </p>
          )}
        </div>

        {/* Decorative pattern */}
        <div className="absolute right-0 top-0 w-64 h-full opacity-10 pointer-events-none">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-full fill-current"
          >
            <circle cx="80" cy="20" r="40" />
            <circle cx="90" cy="80" r="30" />
            <circle cx="20" cy="90" r="20" />
          </svg>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Pending</div>
              <div className="text-2xl font-bold">{formatCurrency(data.pendingCashback)}</div>
              <p className="text-xs text-muted-foreground mt-1">Releases after 30-day window</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Available</div>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(availableCashback)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ready to withdraw</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary/20 text-secondary-foreground flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Reward Pts</div>
              <div className="text-2xl font-bold text-secondary-foreground">
                {formatNumber(data.rewardPoints)}{" "}
                <span className="text-sm font-medium text-muted-foreground">pts</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Redeem for extra deals</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Activity</h2>
        </div>

        {txLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : transactions && transactions.length > 0 ? (
          <Card className="bg-white overflow-hidden divide-y divide-border/50">
            {transactions.map((tx) => {
              const meta = txMeta(tx.type);
              return (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-4">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-accent/60 ${meta.color}`}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{meta.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{tx.description}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm ${txAmountClass(tx)}`}>
                      {tx.amount >= 0 ? "+" : ""}
                      {formatCurrency(tx.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString("en-BD", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        ) : (
          <Card className="bg-white overflow-hidden">
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center bg-accent/30 rounded-2xl border border-dashed border-border/60 mx-4 my-4">
              <History className="w-10 h-10 mb-3 opacity-20" />
              <p className="font-medium text-sm">No recent transactions.</p>
              <p className="text-xs mt-1">Start shopping to earn cashback!</p>
            </div>
          </Card>
        )}
      </div>

      {/* Withdraw dialog */}
      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        maxAmount={availableCashback}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["/api/wallet/summary", isSignedIn] });
          void queryClient.invalidateQueries({
            queryKey: ["/api/wallet/transactions", isSignedIn],
          });
        }}
      />
    </div>
  );
}
