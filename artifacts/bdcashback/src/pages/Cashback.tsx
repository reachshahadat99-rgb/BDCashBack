import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Percent, TrendingUp, ArrowRight, Star, ShieldCheck, Wallet, Info } from "lucide-react";
import { useAuth } from "@clerk/react";
import { useGetMarketplaceSummary } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Shop at partner stores",
    desc: "Browse our marketplace and buy from cashback-enabled merchants.",
    icon: "🛍️",
  },
  {
    step: "02",
    title: "Earn cashback instantly",
    desc: "A percentage of your purchase is credited to your BDCashBack wallet.",
    icon: "💰",
  },
  {
    step: "03",
    title: "Withdraw or redeem",
    desc: "Cash out to your bank account or use rewards on future purchases.",
    icon: "🏦",
  },
];

const RATES = [
  { category: "Fashion", rate: "Up to 25%", icon: "👗", color: "bg-pink-50 border-pink-200 text-pink-700" },
  { category: "Electronics", rate: "Up to 12%", icon: "💻", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { category: "Beauty", rate: "Up to 18%", icon: "🌸", color: "bg-rose-50 border-rose-200 text-rose-700" },
  { category: "Food & Dining", rate: "Up to 20%", icon: "🍜", color: "bg-orange-50 border-orange-200 text-orange-700" },
  { category: "Home & Living", rate: "Up to 10%", icon: "🏠", color: "bg-teal-50 border-teal-200 text-teal-700" },
  { category: "Travel", rate: "Up to 15%", icon: "✈️", color: "bg-sky-50 border-sky-200 text-sky-700" },
];

export default function Cashback() {
  const { isLoaded, isSignedIn } = useAuth();
  const { data } = useGetMarketplaceSummary();

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-12 animate-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-teal-800 text-white p-8 md:p-12 shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-sm font-semibold">
            <Percent className="w-4 h-4" />
            Cashback Program
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Earn real money back on every purchase
          </h1>
          <p className="text-teal-100 text-lg leading-relaxed">
            BDCashBack automatically adds a percentage of your spending back into your wallet — no vouchers, no points, just Taka.
          </p>
          {isLoaded && isSignedIn && data && (
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 mt-2">
              <Wallet className="w-5 h-5 text-secondary" />
              <div>
                <div className="text-xs text-teal-200">Your available cashback</div>
                <div className="font-black text-xl">{formatCurrency(data.wallet.availableCashback)}</div>
              </div>
              <Link href="/wallet">
                <Button className="bg-white text-primary hover:bg-white/90 text-sm font-bold ml-2 h-9 px-4">
                  Withdraw
                </Button>
              </Link>
            </div>
          )}
          {(!isLoaded || !isSignedIn) && (
            <Link href="/sign-in">
              <Button className="bg-white text-primary hover:bg-white/90 font-bold gap-2 mt-2">
                Start earning cashback <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          )}
        </div>
        <div className="absolute -top-16 -right-16 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-8 w-56 h-56 bg-teal-400/20 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* How it works */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">How cashback works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map((step) => (
            <Card key={step.step} className="border-border/60 hover:shadow-md transition-all">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{step.icon}</span>
                  <span className="text-xs font-bold text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                    Step {step.step}
                  </span>
                </div>
                <h3 className="font-bold text-base">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Cashback rates by category */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Cashback rates by category</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5" />
            Rates vary by merchant
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {RATES.map((r) => (
            <Link key={r.category} href={`/products?category=${r.category.toLowerCase().replace(/ & /g, "-")}`}>
              <Card className={`border cursor-pointer hover:shadow-md transition-all ${r.color} bg-opacity-60`}>
                <CardContent className="p-5 flex items-center gap-4">
                  <span className="text-3xl">{r.icon}</span>
                  <div>
                    <div className="font-semibold text-sm">{r.category}</div>
                    <div className="font-black text-lg">{r.rate}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust signals */}
      <section>
        <Card className="border-border/60 bg-accent/30">
          <CardContent className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="space-y-2">
                <ShieldCheck className="w-8 h-8 text-primary mx-auto" />
                <div className="font-bold text-lg">Guaranteed payouts</div>
                <p className="text-sm text-muted-foreground">Cashback is credited within 24–72 hours of purchase confirmation.</p>
              </div>
              <div className="space-y-2">
                <TrendingUp className="w-8 h-8 text-primary mx-auto" />
                <div className="font-bold text-lg">No caps, no tricks</div>
                <p className="text-sm text-muted-foreground">Earn as much as you spend — your wallet grows with every purchase.</p>
              </div>
              <div className="space-y-2">
                <Star className="w-8 h-8 text-secondary mx-auto fill-secondary" />
                <div className="font-bold text-lg">Stack with coupons</div>
                <p className="text-sm text-muted-foreground">Use promo codes on top of cashback for maximum savings.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Ready to start earning?</h2>
        <p className="text-muted-foreground">Browse partner stores and watch your wallet grow.</p>
        <Link href="/products">
          <Button size="lg" className="gap-2 font-bold px-8">
            Shop & earn cashback <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
