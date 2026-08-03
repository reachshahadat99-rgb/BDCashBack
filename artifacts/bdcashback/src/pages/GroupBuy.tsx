import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, TrendingDown, ArrowRight, UserPlus } from "lucide-react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";

const GROUP_DEALS = [
  {
    id: "gb1",
    title: "Samsung Galaxy A55",
    image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=400&q=80",
    originalPrice: 44990,
    groupPrice: 34990,
    savings: 22,
    cashback: 8,
    joined: 34,
    required: 50,
    endsIn: "18:00:00",
    category: "Electronics",
    accent: "bg-blue-500",
  },
  {
    id: "gb2",
    title: "Aarong Ethnic Kurti Bundle (Set of 3)",
    image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=400&q=80",
    originalPrice: 7500,
    groupPrice: 4999,
    savings: 33,
    cashback: 12,
    joined: 62,
    required: 100,
    endsIn: "06:30:00",
    category: "Fashion",
    accent: "bg-pink-500",
  },
  {
    id: "gb3",
    title: "North End Coffee — Monthly Box (4 bags)",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=400&q=80",
    originalPrice: 3800,
    groupPrice: 2600,
    savings: 32,
    cashback: 10,
    joined: 88,
    required: 100,
    endsIn: "02:15:00",
    category: "Food",
    accent: "bg-amber-600",
  },
  {
    id: "gb4",
    title: "COSRX Skincare Starter Kit",
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=400&q=80",
    originalPrice: 5200,
    groupPrice: 3200,
    savings: 38,
    cashback: 15,
    joined: 27,
    required: 60,
    endsIn: "23:45:00",
    category: "Beauty",
    accent: "bg-rose-500",
  },
];

function formatCurrencyBD(n: number) {
  return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(n);
}

export default function GroupBuy() {
  const { isLoaded, isSignedIn } = useAuth();
  const [joined, setJoined] = useState<Record<string, boolean>>({});

  function join(id: string) {
    if (!isSignedIn) return;
    setJoined((prev) => ({ ...prev, [id]: true }));
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-10 animate-in">
      {/* Header */}
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
            Join group orders and unlock prices that go as low as 40% off — plus cashback on top.
          </p>
        </div>
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-4 text-center">
        {[
          { icon: UserPlus, label: "Join a group deal", desc: "Pick a product below and join the pool" },
          { icon: Users, label: "Others join too", desc: "Once the minimum is reached, the price drops" },
          { icon: TrendingDown, label: "Pay the low price", desc: "Charged at group price + cashback credited" },
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

      {/* Active group deals */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">Active Group Deals</h2>
          <Badge className="bg-violet-100 text-violet-700 border-none uppercase text-[10px]">
            {GROUP_DEALS.length} open
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {GROUP_DEALS.map((deal) => {
            const progress = Math.round((deal.joined / deal.required) * 100);
            const alreadyJoined = joined[deal.id];

            return (
              <Card key={deal.id} className="overflow-hidden border-border/60 hover:shadow-md transition-all">
                <div className="flex gap-0">
                  <div className="w-28 md:w-36 shrink-0 relative overflow-hidden">
                    <img src={deal.image} alt={deal.title} className="w-full h-full object-cover" />
                    <div className={`absolute top-2 left-2 w-2 h-2 rounded-full ${deal.accent}`} />
                  </div>
                  <CardContent className="p-4 flex-1 space-y-3 min-w-0">
                    <div>
                      <Badge variant="outline" className="text-[10px] mb-1">{deal.category}</Badge>
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">{deal.title}</h3>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-primary">{formatCurrencyBD(deal.groupPrice)}</span>
                      <span className="text-xs text-muted-foreground line-through">{formatCurrencyBD(deal.originalPrice)}</span>
                      <Badge variant="cashback" className="text-[10px]">-{deal.savings}%</Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {deal.joined}/{deal.required} joined
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {deal.endsIn}
                        </span>
                      </div>
                      <div className="w-full bg-accent rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {isLoaded && !isSignedIn ? (
                      <Link href="/sign-in">
                        <Button size="sm" className="w-full gap-1" variant="outline">
                          Sign in to join <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full gap-1"
                        variant={alreadyJoined ? "secondary" : "default"}
                        onClick={() => join(deal.id)}
                        disabled={alreadyJoined}
                      >
                        {alreadyJoined ? "✓ Joined!" : (
                          <><UserPlus className="w-3.5 h-3.5" /> Join Group · +{deal.cashback}% CB</>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
