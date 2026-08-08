import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Clock,
  TrendingDown,
  ArrowRight,
  UserPlus,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListGroupBuyDeals,
  useJoinGroupBuyDeal,
  getListGroupBuyDealsQueryKey,
  type GroupBuyDeal,
  type GroupBuyOrder,
  JoinGroupBuyRequestPaymentMethod,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";

const PAYMENT_METHODS: { value: keyof typeof JoinGroupBuyRequestPaymentMethod; label: string; hint: string }[] = [
  { value: "bkash", label: "bKash", hint: "Mobile wallet" },
  { value: "nagad", label: "Nagad", hint: "Mobile wallet" },
  { value: "card", label: "Card", hint: "Visa / Mastercard" },
];

function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  return `${h}h ${m}m left`;
}

function JoinDialog({
  deal,
  open,
  onClose,
}: {
  deal: GroupBuyDeal;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"bkash" | "nagad" | "card">("bkash");
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<GroupBuyOrder | null>(null);

  const join = useJoinGroupBuyDeal();

  const totalAmount = deal.groupPrice * quantity;
  const deposit = Math.round((totalAmount * deal.depositPercent) / 100);
  const due = totalAmount - deposit;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    join.mutate(
      { id: deal.id, data: { fullName, phone, address, quantity, paymentMethod } },
      {
        onSuccess: (order) => {
          setConfirmedOrder(order);
          void queryClient.invalidateQueries({ queryKey: getListGroupBuyDealsQueryKey() });
        },
        onError: (err: unknown) => {
          const message =
            err && typeof err === "object" && "error" in err && typeof err.error === "string"
              ? err.error
              : "Could not place your reservation. Please try again.";
          setError(message);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {confirmedOrder ? (
          <div className="space-y-4 text-center py-2">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <DialogHeader>
              <DialogTitle className="text-center">You're in!</DialogTitle>
              <DialogDescription className="text-center">
                Your spot in <span className="font-semibold">{deal.title}</span> is reserved.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border bg-muted/40 p-4 text-sm text-left space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Payment ref</span><span className="font-mono font-semibold">{confirmedOrder.paymentRef ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span>{confirmedOrder.quantity}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Deposit paid</span><span className="font-semibold text-green-600">{formatCurrency(confirmedOrder.depositPaid)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Due when group completes</span><span className="font-semibold">{formatCurrency(confirmedOrder.dueAmount)}</span></div>
            </div>
            <p className="text-xs text-muted-foreground">
              We'll collect the balance once the group reaches {deal.minParticipants} participants.
            </p>
            <Button className="w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Join group buy</DialogTitle>
              <DialogDescription>
                {deal.title} — reserve your spot with a {deal.depositPercent}% deposit.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="gb-name">Full name</label>
                <Input id="gb-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="gb-phone">Mobile number</label>
                <Input id="gb-phone" required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="gb-address">Delivery address</label>
                <Textarea id="gb-address" required rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, road, area, city" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="gb-qty">Quantity (max 5)</label>
                <Input
                  id="gb-qty"
                  type="number"
                  min={1}
                  max={5}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Pay deposit with</span>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm.value}
                      type="button"
                      onClick={() => setPaymentMethod(pm.value)}
                      className={`rounded-lg border p-2 text-center transition-colors ${
                        paymentMethod === pm.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="text-sm font-semibold">{pm.label}</div>
                      <div className="text-[10px] text-muted-foreground">{pm.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Group price × {quantity}</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-primary">
                <span className="flex items-center gap-1"><Wallet className="w-4 h-4" /> Deposit now ({deal.depositPercent}%)</span>
                <span>{formatCurrency(deposit)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Balance on group completion</span>
                <span>{formatCurrency(due)}</span>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={join.isPending}>
              {join.isPending ? "Reserving..." : `Pay ${formatCurrency(deposit)} deposit & join`}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function GroupBuy() {
  const { isLoaded, isSignedIn } = useAuth();
  const [activeDeal, setActiveDeal] = useState<GroupBuyDeal | null>(null);

  const dealsQuery = useListGroupBuyDeals();
  const deals = useMemo(() => dealsQuery.data ?? [], [dealsQuery.data]);
  const openCount = deals.filter((d) => d.status === "open").length;

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-10 animate-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-8 shadow-lg">
        <div className="relative z-10 space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-sm font-semibold">
            <Users className="w-4 h-4" />
            Group Buy
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Buy together,<br />save together
          </h1>
          <p className="text-violet-100 text-lg">
            Reserve your spot with a small deposit and unlock prices up to 40% off — plus cashback on top.
          </p>
        </div>
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        {[
          { icon: UserPlus, label: "Reserve your spot", desc: "Fill the order form and pay a small deposit" },
          { icon: Users, label: "Others join too", desc: "Once the minimum is reached, the deal locks in" },
          { icon: TrendingDown, label: "Pay the balance", desc: "Balance due at group price + cashback credited" },
        ].map((s, i) => (
          <Card key={i} className="border-border/60">
            <CardContent className="p-5 flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center">
                <s.icon className="w-5 h-5" />
              </div>
              <div className="font-semibold text-sm">{s.label}</div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">Active Group Deals</h2>
          <Badge className="bg-violet-100 text-violet-700 border-none uppercase text-[10px]">
            {openCount} open
          </Badge>
        </div>

        {dealsQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : dealsQuery.isError ? (
          <Card className="border-destructive/40">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Couldn't load group deals.{" "}
              <button className="underline font-medium" onClick={() => void dealsQuery.refetch()}>
                Try again
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {deals.map((deal) => {
              const progress = Math.min(100, Math.round((deal.joinedCount / deal.minParticipants) * 100));
              const savings = Math.round((1 - deal.groupPrice / deal.originalPrice) * 100);
              const joined = deal.myOrder != null;
              const closed = deal.status !== "open";

              return (
                <Card key={deal.id} className="overflow-hidden border-border/60 hover:shadow-md transition-all">
                  <div className="flex gap-0">
                    <div className="w-28 md:w-36 shrink-0 relative overflow-hidden">
                      <img src={deal.image} alt={deal.title} className="w-full h-full object-cover" />
                    </div>
                    <CardContent className="p-4 flex-1 space-y-3 min-w-0">
                      <div>
                        <Badge variant="outline" className="text-[10px] mb-1">{deal.category}</Badge>
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{deal.title}</h3>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-primary">{formatCurrency(deal.groupPrice)}</span>
                        <span className="text-xs text-muted-foreground line-through">{formatCurrency(deal.originalPrice)}</span>
                        <Badge variant="cashback" className="text-[10px]">-{savings}%</Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {deal.joinedCount}/{deal.minParticipants} joined
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeLeft(deal.endsAt)}
                          </span>
                        </div>
                        <div className="w-full bg-accent rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      {joined ? (
                        <div className="rounded-lg bg-green-50 border border-green-200 p-2 text-xs space-y-0.5">
                          <div className="flex items-center gap-1 font-semibold text-green-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Reserved · {deal.myOrder!.quantity} pc
                          </div>
                          <div className="text-green-700/80">
                            Paid {formatCurrency(deal.myOrder!.depositPaid)} deposit · {formatCurrency(deal.myOrder!.dueAmount)} due
                          </div>
                        </div>
                      ) : isLoaded && !isSignedIn ? (
                        <Link href="/sign-in">
                          <Button size="sm" className="w-full gap-1" variant="outline">
                            Sign in to join <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full gap-1"
                          disabled={closed || !isLoaded}
                          onClick={() => setActiveDeal(deal)}
                        >
                          {closed ? "Deal closed" : (
                            <><UserPlus className="w-3.5 h-3.5" /> Join Group · +{deal.cashbackPercent}% CB</>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {activeDeal && (
        <JoinDialog deal={activeDeal} open onClose={() => setActiveDeal(null)} />
      )}
    </div>
  );
}
