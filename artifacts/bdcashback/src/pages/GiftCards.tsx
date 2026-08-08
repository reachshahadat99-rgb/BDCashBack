import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, ArrowRight, CheckCircle2, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListGiftCardBrands,
  usePurchaseGiftCard,
  useListMyGiftCardOrders,
  getListGiftCardBrandsQueryKey,
  getListMyGiftCardOrdersQueryKey,
  type GiftCardBrandView,
  type GiftCardView,
  type GiftCardPurchase,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";

const GRADIENTS = [
  "from-primary to-teal-700",
  "from-orange-500 to-red-600",
  "from-pink-500 to-rose-600",
  "from-blue-600 to-violet-700",
  "from-amber-600 to-yellow-700",
];

function gradientFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

const PAYMENT_METHODS: { value: "bkash" | "nagad" | "card"; label: string }[] = [
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "card", label: "Card" },
];

function PurchaseDialog({
  brand,
  card,
  onClose,
}: {
  brand: GiftCardBrandView;
  card: GiftCardView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const purchase = usePurchaseGiftCard();
  const [paymentMethod, setPaymentMethod] = useState<"bkash" | "nagad" | "card">("bkash");
  const [error, setError] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<GiftCardPurchase | null>(null);

  const discount = Math.round(((card.faceValue - card.price) / card.faceValue) * 100);

  function handleBuy() {
    setError(null);
    purchase.mutate(
      { id: card.id, data: { paymentMethod } },
      {
        onSuccess: (order) => {
          setDelivered(order);
          void queryClient.invalidateQueries({ queryKey: getListGiftCardBrandsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListMyGiftCardOrdersQueryKey() });
        },
        onError: (err: unknown) => {
          const message =
            err && typeof err === "object" && "error" in err && typeof err.error === "string"
              ? err.error
              : "Purchase failed. Please try again.";
          setError(message);
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        {delivered ? (
          <div className="space-y-4 text-center py-2">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <DialogHeader>
              <DialogTitle className="text-center">Gift card delivered!</DialogTitle>
              <DialogDescription className="text-center">
                Your {delivered.brandName} card worth {formatCurrency(delivered.faceValue)} is ready.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Card code</div>
              <div className="font-mono font-black text-lg tracking-wider text-primary break-all">
                {delivered.cardCode}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Payment ref {delivered.paymentRef} · also saved under "My gift cards" below.
            </div>
            <Button className="w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Buy {brand.name} gift card</DialogTitle>
              <DialogDescription>
                Pay {formatCurrency(card.price)} and receive a {formatCurrency(card.faceValue)} card
                instantly — {discount}% off.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Card value</span>
                <span>{formatCurrency(card.faceValue)}</span>
              </div>
              <div className="flex justify-between font-semibold text-primary">
                <span className="flex items-center gap-1"><Wallet className="w-4 h-4" /> You pay</span>
                <span>{formatCurrency(card.price)}</span>
              </div>
              <div className="flex justify-between text-green-600 font-medium">
                <span>You save</span>
                <span>{formatCurrency(card.faceValue - card.price)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Pay with</span>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    type="button"
                    onClick={() => setPaymentMethod(pm.value)}
                    className={`rounded-lg border p-2 text-sm font-semibold transition-colors ${
                      paymentMethod === pm.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleBuy} disabled={purchase.isPending}>
              {purchase.isPending ? "Processing..." : `Pay ${formatCurrency(card.price)}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MyGiftCards() {
  const { data } = useListMyGiftCardOrders();
  if (!data || data.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">My gift cards</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((order) => (
          <Card key={order.id} className="border-border/60">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{order.brandName}</span>
                <Badge variant="cashback">{formatCurrency(order.faceValue)}</Badge>
              </div>
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 font-mono font-bold text-sm tracking-wider text-primary break-all">
                {order.cardCode}
              </div>
              <div className="text-xs text-muted-foreground">
                Paid {formatCurrency(order.pricePaid)} via {order.paymentMethod} ·{" "}
                {new Intl.DateTimeFormat("en-BD", { month: "short", day: "numeric" }).format(
                  new Date(order.createdAt),
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function GiftCards() {
  const { isLoaded, isSignedIn } = useAuth();
  const { data, isLoading, isError, refetch } = useListGiftCardBrands();
  const [selected, setSelected] = useState<{ brand: GiftCardBrandView; card: GiftCardView } | null>(
    null,
  );

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-10 animate-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 to-pink-700 text-white p-8 shadow-lg">
        <div className="relative z-10 space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-sm font-semibold">
            <Gift className="w-4 h-4" />
            Gift Cards
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Full value, discounted price
          </h1>
          <p className="text-pink-100 text-lg">
            Buy digital gift cards from authorized partners below face value — delivered instantly.
          </p>
        </div>
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {isSignedIn && <MyGiftCards />}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Couldn't load gift cards.{" "}
            <button className="underline font-medium" onClick={() => void refetch()}>
              Try again
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(data ?? []).map((brand) => (
            <Card key={brand.id} className="overflow-hidden border-border/60 hover:shadow-md transition-all">
              <div
                className={`relative bg-gradient-to-br ${gradientFor(brand.id)} p-6 aspect-[2/1] flex flex-col justify-between`}
              >
                <Gift className="w-8 h-8 text-white/70" />
                <div>
                  <div className="text-2xl font-black text-white">{brand.name}</div>
                  <div className="text-sm text-white/80 mt-0.5">{brand.description}</div>
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                {brand.cards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sold out — check back soon.</p>
                ) : (
                  <div className="space-y-2">
                    {brand.cards.map((card) => {
                      const discount = Math.round(
                        ((card.faceValue - card.price) / card.faceValue) * 100,
                      );
                      return (
                        <div
                          key={card.id}
                          className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
                        >
                          <div>
                            <div className="font-bold text-sm">{formatCurrency(card.faceValue)} card</div>
                            <div className="text-xs text-muted-foreground">
                              Pay {formatCurrency(card.price)}{" "}
                              <Badge variant="cashback" className="text-[10px] ml-1">-{discount}%</Badge>
                            </div>
                          </div>
                          {isLoaded && !isSignedIn ? (
                            <Link href="/sign-in">
                              <Button size="sm" variant="outline" className="gap-1">
                                Sign in <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          ) : (
                            <Button size="sm" onClick={() => setSelected({ brand, card })}>
                              Buy
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <PurchaseDialog brand={selected.brand} card={selected.card} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
