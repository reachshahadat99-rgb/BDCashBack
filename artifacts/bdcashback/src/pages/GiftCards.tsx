import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Gift, Send, CreditCard, ArrowRight, CheckCircle } from "lucide-react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";

const GIFT_CARDS = [
  {
    id: "gc-bdcashback",
    brand: "BDCashBack",
    description: "Universal gift card accepted across all partner stores",
    amounts: [500, 1000, 2000, 5000],
    color: "from-primary to-teal-700",
    textColor: "text-white",
    cashback: 5,
    popular: true,
  },
  {
    id: "gc-aarong",
    brand: "Aarong",
    description: "Premium handcraft & lifestyle store",
    amounts: [1000, 2000, 5000],
    color: "from-amber-600 to-yellow-700",
    textColor: "text-white",
    cashback: 8,
    popular: false,
  },
  {
    id: "gc-daraz",
    brand: "Daraz",
    description: "Bangladesh's largest online marketplace",
    amounts: [500, 1000, 2000, 5000, 10000],
    color: "from-orange-500 to-red-600",
    textColor: "text-white",
    cashback: 6,
    popular: false,
  },
  {
    id: "gc-shajgoj",
    brand: "Shajgoj",
    description: "Beauty, skincare & wellness",
    amounts: [500, 1000, 2500],
    color: "from-pink-500 to-rose-600",
    textColor: "text-white",
    cashback: 10,
    popular: false,
  },
  {
    id: "gc-pathao",
    brand: "Pathao Food",
    description: "Food delivery across Dhaka",
    amounts: [300, 500, 1000],
    color: "from-red-500 to-rose-700",
    textColor: "text-white",
    cashback: 7,
    popular: false,
  },
  {
    id: "gc-klay",
    brand: "Klay",
    description: "Handmade home & ceramics",
    amounts: [1000, 2000, 5000],
    color: "from-teal-600 to-emerald-700",
    textColor: "text-white",
    cashback: 9,
    popular: false,
  },
];

export default function GiftCards() {
  const { isLoaded, isSignedIn } = useAuth();
  const [selected, setSelected] = useState<{ id: string; amount: number } | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleBuy(cardId: string, amount: number) {
    setSelected({ id: cardId, amount });
    setSent(false);
  }

  function handleSend() {
    if (!recipientEmail.trim()) return;
    setSent(true);
    setSelected(null);
    setRecipientEmail("");
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-10 animate-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 to-pink-700 text-white p-8 shadow-lg">
        <div className="relative z-10 space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-sm font-semibold">
            <Gift className="w-4 h-4" />
            Gift Cards
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            The gift they'll actually use
          </h1>
          <p className="text-pink-100 text-lg">
            Digital gift cards for every occasion — with cashback when you buy them.
          </p>
        </div>
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Success toast */}
      {sent && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-green-50 border border-green-200 text-green-800">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <div className="font-semibold">Gift card sent!</div>
            <div className="text-sm text-green-700">Your recipient will receive an email with their code shortly.</div>
          </div>
        </div>
      )}

      {/* Purchase dialog */}
      {selected && (
        <Card className="border-primary/40 shadow-lg">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-bold text-lg">Complete your gift card purchase</h3>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-accent">
              <CreditCard className="w-5 h-5 text-primary" />
              <span className="font-semibold">{GIFT_CARDS.find((c) => c.id === selected.id)?.brand}</span>
              <span className="ml-auto font-black text-primary text-lg">{formatCurrency(selected.amount)}</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Send to (email)</label>
              <Input
                placeholder="recipient@email.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="bg-white"
              />
              <p className="text-xs text-muted-foreground">Leave blank to keep for yourself.</p>
            </div>
            <div className="flex gap-3">
              {isLoaded && !isSignedIn ? (
                <Link href="/sign-in" className="flex-1">
                  <Button className="w-full gap-2">Sign in to buy <ArrowRight className="w-4 h-4" /></Button>
                </Link>
              ) : (
                <Button className="flex-1 gap-2" onClick={handleSend}>
                  <Send className="w-4 h-4" />
                  {recipientEmail ? "Send Gift Card" : "Buy for Myself"}
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {GIFT_CARDS.map((card) => (
          <Card key={card.id} className="overflow-hidden border-border/60 hover:shadow-md transition-all">
            {/* Visual card */}
            <div className={`relative bg-gradient-to-br ${card.color} p-6 aspect-[2/1] flex flex-col justify-between`}>
              {card.popular && (
                <Badge className="absolute top-3 right-3 bg-white/20 text-white border-none text-[10px]">
                  Popular
                </Badge>
              )}
              <div className="flex items-start justify-between">
                <Gift className="w-8 h-8 text-white/70" />
                <Badge className="bg-white/20 text-white border-none text-xs font-bold">+{card.cashback}% CB</Badge>
              </div>
              <div>
                <div className={`text-2xl font-black ${card.textColor}`}>{card.brand}</div>
                <div className={`text-sm ${card.textColor} opacity-80 mt-0.5`}>{card.description}</div>
              </div>
            </div>

            <CardContent className="p-4 space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Select amount</div>
                <div className="flex flex-wrap gap-2">
                  {card.amounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleBuy(card.id, amount)}
                      className="px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary border-border"
                    >
                      ৳{amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Earn {card.cashback}% cashback when you purchase this gift card.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
