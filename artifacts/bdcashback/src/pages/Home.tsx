import { useState, useEffect } from "react";
import { useGetMarketplaceSummary, useListGroupBuyDeals, useListGiftCardBrands } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles, Clock, TrendingUp, ShoppingBag, Flame, Percent,
  Ticket, Users, Gift, ChevronRight, ArrowRight, Star,
  CheckCircle2, Wallet as WalletIcon, Play, Zap, Shield,
  BadgePercent, Store, Banknote,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Countdown Timer Hook
// ---------------------------------------------------------------------------
function useCountdown(endsAt: string) {
  const calc = () => Math.max(0, new Date(endsAt).getTime() - Date.now());
  const [ms, setMs] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setMs(calc()), 1000);
    return () => clearInterval(t);
  }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return { h, m, s, expired: ms === 0 };
}

// ---------------------------------------------------------------------------
// Small reusable: countdown pill
// ---------------------------------------------------------------------------
function CountdownPill({ endsAt }: { endsAt: string }) {
  const { h, m, s, expired } = useCountdown(endsAt);
  if (expired) return <span className="text-xs text-destructive font-semibold">Expired</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-white/90">
      <Clock className="w-3 h-3" />
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section: Hero
// ---------------------------------------------------------------------------
const dealAccents: Record<string, string> = {
  violet: "linear-gradient(135deg, #d946ef, #a855f7)",
  coral: "linear-gradient(135deg, #ff7a59, #f97316)",
  mint: "linear-gradient(135deg, #0f9f8f, #087f73)",
};

function Hero({ topCashback, wallet, isSignedIn, isLoaded }: {
  topCashback?: number;
  wallet?: { balance: number };
  isSignedIn: boolean;
  isLoaded: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-500 text-white">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 w-72 h-72 bg-teal-400/30 rounded-full blur-2xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 p-6 md:p-12">
        <div className="space-y-5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            Up to{" "}
            <span className="text-yellow-300">{topCashback ?? "—"}% Cashback</span>{" "}
            on top deals
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Make every Taka<br />
            <span className="text-yellow-300">count.</span>
          </h1>

          <p className="text-teal-100 text-lg md:text-xl leading-relaxed">
            Shop your favourite brands, earn cashback automatically, withdraw to bKash or your bank — zero fees.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/products">
              <Button size="lg" className="bg-white text-teal-700 hover:bg-white/90 font-bold rounded-xl shadow-lg shadow-teal-900/30 text-base h-12 px-7">
                Explore Deals <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/signup/merchant">
              <Button size="lg" variant="outline" className="border-white/50 text-white hover:bg-white/10 font-bold rounded-xl text-base h-12 px-7">
                Become a Merchant
              </Button>
            </Link>
          </div>
        </div>

        {/* Wallet card */}
        <div className="w-full md:w-72 shrink-0">
          <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-teal-100">Your Wallet</span>
              <WalletIcon className="w-5 h-5 text-yellow-300" />
            </div>
            {isLoaded && isSignedIn ? (
              <>
                <div className="text-4xl font-black">{formatCurrency(wallet?.balance ?? 0)}</div>
                <div className="text-xs text-teal-200 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-yellow-300" />
                  Available balance
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">Start earning</div>
                <div className="text-xs text-teal-200">Sign in to see your cashback wallet</div>
              </>
            )}
            <Link
              href={isSignedIn ? "/wallet" : "/sign-in"}
              className="block w-full text-center bg-white text-teal-700 font-bold py-2.5 rounded-xl text-sm hover:bg-white/90 transition-colors"
            >
              {isSignedIn ? "View Wallet" : "Sign in to earn"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Trust Bar
// ---------------------------------------------------------------------------
const TRUST_STATS = [
  { icon: Banknote, label: "Cashback Paid", value: "৳2.4M+" },
  { icon: Store, label: "Active Merchants", value: "120+" },
  { icon: Users, label: "Happy Customers", value: "15,000+" },
  { icon: ShoppingBag, label: "Orders Completed", value: "48,000+" },
];

function TrustBar() {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {TRUST_STATS.map((s) => (
        <div
          key={s.label}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card py-6 px-4 text-center shadow-sm hover:shadow-md transition-shadow"
        >
          <s.icon className="w-7 h-7 text-primary" />
          <div className="text-2xl font-black tracking-tight">{s.value}</div>
          <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Feature shortcuts
// ---------------------------------------------------------------------------
const SHORTCUTS = [
  { href: "/products", icon: ShoppingBag, label: "Shop", desc: "All stores", color: "bg-teal-50 text-teal-700 border-teal-200", iconBg: "bg-teal-100" },
  { href: "/deals", icon: Flame, label: "Deals", desc: "Limited time", color: "bg-red-50 text-red-700 border-red-200", iconBg: "bg-red-100" },
  { href: "/cashback", icon: Percent, label: "Cashback", desc: "Earn back", color: "bg-emerald-50 text-emerald-700 border-emerald-200", iconBg: "bg-emerald-100" },
  { href: "/coupons", icon: Ticket, label: "Coupons", desc: "Promo codes", color: "bg-violet-50 text-violet-700 border-violet-200", iconBg: "bg-violet-100" },
  { href: "/group-buy", icon: Users, label: "Group Buy", desc: "Buy together", color: "bg-indigo-50 text-indigo-700 border-indigo-200", iconBg: "bg-indigo-100" },
  { href: "/gift-cards", icon: Gift, label: "Gift Cards", desc: "Send a gift", color: "bg-pink-50 text-pink-700 border-pink-200", iconBg: "bg-pink-100" },
];

function Shortcuts() {
  return (
    <section>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {SHORTCUTS.map((f) => (
          <Link key={f.href} href={f.href} className="group">
            <div className={cn("flex flex-col items-center gap-2 p-3 md:p-4 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5", f.color)}>
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform", f.iconBg)}>
                <f.icon className="w-5 h-5" />
              </div>
              <div className="text-center">
                <div className="text-sm font-bold leading-tight">{f.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5 hidden md:block">{f.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Categories
// ---------------------------------------------------------------------------
function Categories({ categories, isLoading }: {
  categories?: { id: string; name: string; icon: string; productCount: number }[];
  isLoading: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold">Shop by Category</h2>
        <Link href="/products" className="text-sm font-semibold text-primary flex items-center hover:underline">
          See all <ChevronRight className="w-4 h-4 ml-0.5" />
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="min-w-[100px] h-32 rounded-2xl flex-shrink-0" />
            ))
          : (categories ?? []).length === 0
          ? <p className="text-muted-foreground text-sm py-4">No categories yet.</p>
          : (categories ?? []).map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.id}`}
                className="group flex flex-col items-center justify-center min-w-[100px] gap-3 p-4 rounded-2xl bg-card border hover:border-primary/50 hover:shadow-md transition-all snap-start flex-shrink-0"
              >
                <div className="w-14 h-14 rounded-full bg-accent text-primary flex items-center justify-center text-2xl font-black group-hover:scale-110 transition-transform">
                  {cat.icon || cat.name.charAt(0)}
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold whitespace-nowrap">{cat.name}</div>
                  <div className="text-xs text-muted-foreground">{cat.productCount} items</div>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Flash Deals Carousel
// ---------------------------------------------------------------------------
function FlashDeals({ deals, isLoading }: {
  deals?: { id: string; title: string; subtitle: string; accent: string; endsAt: string; cashbackPercent: number }[];
  isLoading: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl md:text-2xl font-bold">Flash Deals</h2>
        <Badge className="bg-destructive text-destructive-foreground uppercase tracking-widest text-[10px] hover:bg-destructive">
          Ending Soon
        </Badge>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="min-w-[280px] md:min-w-[340px] h-44 rounded-2xl flex-shrink-0" />
            ))
          : (deals ?? []).length === 0
          ? <p className="text-muted-foreground text-sm py-4">No active deals right now.</p>
          : (deals ?? []).map((deal) => (
              <div
                key={deal.id}
                className="relative overflow-hidden rounded-2xl p-6 text-white min-w-[280px] md:min-w-[340px] flex-shrink-0 snap-start"
                style={{ background: dealAccents[deal.accent] ?? dealAccents.mint }}
              >
                <div className="pointer-events-none absolute right-[-10%] bottom-[-10%] w-36 h-36 bg-white/10 rounded-full blur-xl" />
                <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-sm mb-3">
                      <CountdownPill endsAt={deal.endsAt} />
                    </div>
                    <h3 className="text-xl font-bold leading-tight">{deal.title}</h3>
                    <p className="text-white/75 text-sm mt-1">{deal.subtitle}</p>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-white/70 uppercase tracking-wider font-semibold">Cashback</div>
                      <div className="text-4xl font-black">{deal.cashbackPercent}%</div>
                    </div>
                    <Link href="/products" className="inline-flex items-center gap-1 bg-white text-black text-sm font-bold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors">
                      Claim <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Group Buy Highlights
// ---------------------------------------------------------------------------
function GroupBuyHighlights({ isLoading }: { isLoading: boolean }) {
  const { data: gbData, isLoading: gbLoading } = useListGroupBuyDeals();
  const loading = isLoading || gbLoading;
  const campaigns = (gbData ?? []).slice(0, 4);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl md:text-2xl font-bold">Group Buy</h2>
          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">Buy Together, Save More</Badge>
        </div>
        <Link href="/group-buy" className="text-sm font-semibold text-primary flex items-center hover:underline">
          View all <ChevronRight className="w-4 h-4 ml-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)
          : campaigns.length === 0
          ? (
            <div className="col-span-full text-center py-10 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm">No active group buy campaigns.</p>
            </div>
          )
          : campaigns.map((c: any) => {
              const pct = Math.min(100, Math.round(((c.joined ?? 0) / c.minParticipants) * 100));
              return (
                <Link key={c.id} href="/group-buy" className="group">
                  <Card className="h-full hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden">
                    <div className="aspect-video relative overflow-hidden bg-accent/30">
                      {c.image ? (
                        <img src={c.image} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl font-black text-muted-foreground/20">
                          {c.title.charAt(0)}
                        </div>
                      )}
                      <Badge className="absolute top-2 right-2 bg-indigo-600 text-white border-none text-xs">
                        {c.cashbackPercent}% CB
                      </Badge>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">{c.title}</h3>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{c.joined ?? 0}/{c.minParticipants} joined</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-base font-black">{formatCurrency(c.groupPrice)}</div>
                        <div className="text-xs text-muted-foreground line-through">{formatCurrency(c.originalPrice)}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Gift Cards Strip
// ---------------------------------------------------------------------------
function GiftCardsStrip() {
  const { data: brands, isLoading } = useListGiftCardBrands();
  const visible = (brands ?? []).filter((b: any) => b.cards?.length > 0).slice(0, 6);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl md:text-2xl font-bold">Gift Cards</h2>
          <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 text-xs">Discounted</Badge>
        </div>
        <Link href="/gift-cards" className="text-sm font-semibold text-primary flex items-center hover:underline">
          View all <ChevronRight className="w-4 h-4 ml-0.5" />
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="min-w-[140px] h-24 rounded-2xl flex-shrink-0" />)
          : visible.length === 0
          ? <p className="text-muted-foreground text-sm py-4">No gift cards available right now.</p>
          : visible.map((brand: any) => {
              const bestCard = brand.cards?.sort((a: any, b: any) => (b.faceValue - b.price) / b.faceValue - (a.faceValue - a.price) / a.faceValue)[0];
              const discountPct = bestCard
                ? Math.round(((bestCard.faceValue - bestCard.price) / bestCard.faceValue) * 100)
                : 0;
              return (
                <Link key={brand.id} href="/gift-cards" className="group snap-start flex-shrink-0">
                  <div className="min-w-[140px] rounded-2xl border bg-card p-4 flex flex-col items-center gap-2 hover:border-pink-300 hover:shadow-md transition-all group-hover:-translate-y-0.5">
                    <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center overflow-hidden">
                      {brand.logoUrl ? (
                        <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-cover" />
                      ) : (
                        <Gift className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div className="text-sm font-semibold text-center leading-tight">{brand.name}</div>
                    {discountPct > 0 && (
                      <Badge className="bg-pink-500 text-white hover:bg-pink-500 text-xs border-none">
                        {discountPct}% off
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Trending Products
// ---------------------------------------------------------------------------
function TrendingProducts({ products, isLoading }: {
  products?: any[];
  isLoading: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl md:text-2xl font-bold">Trending Offers</h2>
          <Zap className="w-5 h-5 text-yellow-500" />
        </div>
        <Link href="/products" className="text-sm font-semibold text-primary flex items-center hover:underline">
          View more <ChevronRight className="w-4 h-4 ml-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
          : (products ?? []).length === 0
          ? (
            <div className="col-span-full text-center py-10 text-muted-foreground">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm">Products coming soon.</p>
            </div>
          )
          : (products ?? []).map((product) => (
              <Link key={product.id} href="/products" className="group">
                <Card className="h-full border-border/60 hover:border-primary/40 hover:shadow-md transition-all overflow-hidden">
                  <div className="relative aspect-square p-4 bg-accent/30 flex items-center justify-center overflow-hidden">
                    {product.badge && (
                      <Badge className="absolute top-2 left-2 z-10 bg-yellow-500 text-black border-none text-xs">{product.badge}</Badge>
                    )}
                    <Badge variant="cashback" className="absolute top-2 right-2 z-10 font-bold text-xs">
                      {product.cashbackPercent}% CB
                    </Badge>
                    <div className="w-3/4 h-3/4 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-muted-foreground/30 font-black text-4xl">{product.brand?.charAt(0)}</div>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <div className="text-[10px] text-muted-foreground font-medium">{product.brand} · {product.merchant}</div>
                    <h3 className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="font-black text-base">{formatCurrency(product.price)}</span>
                      {product.originalPrice > product.price && (
                        <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.originalPrice)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: How Cashback Works
// ---------------------------------------------------------------------------
const HOW_STEPS = [
  { icon: ShoppingBag, label: "1. Shop", desc: "Browse products from verified merchants. Add to cart and check out securely.", color: "bg-teal-100 text-teal-700" },
  { icon: Clock, label: "2. Wait for Delivery", desc: "Your order is processed. Cashback is held during the 30-day return window.", color: "bg-indigo-100 text-indigo-700" },
  { icon: BadgePercent, label: "3. Cashback Released", desc: "After the return window closes, cashback moves to your Available balance.", color: "bg-emerald-100 text-emerald-700" },
  { icon: Banknote, label: "4. Withdraw", desc: "Transfer to bKash, Nagad, Rocket, or your bank account — no hidden fees.", color: "bg-pink-100 text-pink-700" },
];

function HowCashbackWorks() {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-slate-50 to-teal-50 dark:from-slate-900 dark:to-teal-950 border p-8 md:p-12 space-y-8">
      <div className="text-center space-y-2">
        <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 mb-2">How It Works</Badge>
        <h2 className="text-2xl md:text-3xl font-extrabold">Earn cashback in 4 simple steps</h2>
        <p className="text-muted-foreground max-w-md mx-auto">No complicated rules. Shop as normal and watch your cashback wallet grow.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {HOW_STEPS.map((step, i) => (
          <div key={step.label} className="flex flex-col gap-4">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", step.color)}>
              <step.icon className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-base mb-1">{step.label}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
            {i < HOW_STEPS.length - 1 && (
              <ChevronRight className="hidden lg:block w-6 h-6 text-muted-foreground/30 absolute" />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Link href="/sign-up">
          <Button size="lg" className="font-bold rounded-xl">
            Start Earning Now <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Merchant CTA Band
// ---------------------------------------------------------------------------
function MerchantCTABand() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-8 md:p-12">
      <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 text-center md:text-left">
          <Badge className="bg-teal-500/20 text-teal-300 hover:bg-teal-500/20 border border-teal-500/30">For Merchants</Badge>
          <h2 className="text-2xl md:text-4xl font-extrabold">
            Sell on BDCashBack
          </h2>
          <p className="text-slate-300 max-w-xl text-base md:text-lg">
            Free store setup. No listing fees. You only pay a small success fee on completed sales. Reach 15,000+ active cashback shoppers.
          </p>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
            {["Free to list", "No monthly fees", "Pay on sale only"].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-sm text-teal-300 font-medium">
                <CheckCircle2 className="w-4 h-4" /> {t}
              </div>
            ))}
          </div>
        </div>
        <Link href="/signup/merchant">
          <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-white font-bold rounded-xl whitespace-nowrap shadow-lg shadow-teal-500/20 text-base h-12 px-8">
            Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Watch & Earn Teaser
// ---------------------------------------------------------------------------
function WatchAndEarn() {
  return (
    <section className="rounded-3xl border bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 p-8 flex flex-col md:flex-row items-center gap-6 md:gap-10">
      <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
        <Play className="w-8 h-8 text-white fill-white" />
      </div>
      <div className="text-center md:text-left space-y-2 flex-1">
        <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 mb-1">Coming Soon</Badge>
        <h2 className="text-xl md:text-2xl font-extrabold">Watch & Earn</h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Earn cashback just by watching product videos from your favourite brands. A brand-new way to discover deals.
        </p>
      </div>
      <Button variant="outline" className="border-violet-200 text-violet-700 hover:bg-violet-50 font-bold rounded-xl whitespace-nowrap shrink-0" disabled>
        Notify Me
      </Button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Footer
// ---------------------------------------------------------------------------
const FOOTER_LINKS = {
  Company: ["About Us", "Blog", "Careers", "Press"],
  Legal: ["Terms of Service", "Privacy Policy", "Cookie Policy", "Refund Policy"],
  Support: ["Help Center", "Contact Us", "Report a Problem", "Status"],
  Categories: ["Electronics", "Fashion", "Beauty", "Home & Living", "Sports"],
};

const PAYMENT_METHODS = ["bKash", "Nagad", "Rocket", "SSLCommerz", "Visa", "Mastercard"];

function Footer() {
  return (
    <footer className="border-t bg-muted/30 rounded-t-3xl overflow-hidden">
      <div className="px-6 md:px-10 py-12 space-y-10">
        {/* Brand + social */}
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div className="space-y-4 max-w-xs">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <WalletIcon className="w-5 h-5 text-white" />
              </div>
              <span className="font-extrabold text-xl text-primary">BDCashBack</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bangladesh's cashback marketplace. Shop smarter, earn back, withdraw anytime.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Object.entries(FOOTER_LINKS).map(([title, links]) => (
              <div key={title} className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-foreground/70 hover:text-primary transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Payment methods */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">We Accept</div>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <span
                key={method}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border bg-background text-xs font-bold text-foreground/70"
              >
                {method}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t">
          <p className="text-xs text-muted-foreground">© 2026 BDCashBack. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">Made with ❤️ in Bangladesh</p>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default function Home() {
  const { data, isLoading, isError } = useGetMarketplaceSummary();
  const { isLoaded, isSignedIn } = useAuth();

  const topCashback = data?.deals?.length
    ? Math.max(...data.deals.map((d: any) => Number(d.cashbackPercent)))
    : data?.featuredProducts?.length
    ? Math.max(...data.featuredProducts.map((p: any) => Number(p.cashbackPercent)))
    : undefined;

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">Couldn't load the marketplace</h2>
        <p className="text-muted-foreground max-w-md">Please try again in a moment.</p>
        <Button onClick={() => window.location.reload()}>Refresh</Button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12">
      <div className="container mx-auto px-4 pt-6 md:pt-10 space-y-12">
        <Hero
          topCashback={topCashback}
          wallet={data?.wallet}
          isSignedIn={!!isSignedIn}
          isLoaded={isLoaded}
        />
        <TrustBar />
        <Shortcuts />
        <Categories categories={data?.categories as any} isLoading={isLoading} />
        <FlashDeals deals={data?.deals as any} isLoading={isLoading} />
        <GroupBuyHighlights isLoading={isLoading} />
        <GiftCardsStrip />
        <TrendingProducts products={data?.featuredProducts as any} isLoading={isLoading} />
        <HowCashbackWorks />
        <MerchantCTABand />
        <WatchAndEarn />
      </div>
      <Footer />
    </div>
  );
}
