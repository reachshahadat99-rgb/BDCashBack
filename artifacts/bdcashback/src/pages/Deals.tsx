import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Clock, ArrowRight, Zap, Star } from "lucide-react";
import { useGetMarketplaceSummary, useListPromoDeals } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

const FLASH_DEALS = [
  {
    id: "fd1",
    title: "Flash Friday: Electronics",
    subtitle: "Up to 30% cashback on smartphones, laptops & accessories",
    cashback: 30,
    endsIn: "02:45:18",
    sold: 72,
    color: "from-blue-600 to-violet-700",
    emoji: "⚡",
  },
  {
    id: "fd2",
    title: "Beauty Blowout",
    subtitle: "Skincare, makeup & wellness — extra 22% back today only",
    cashback: 22,
    endsIn: "05:12:00",
    sold: 55,
    color: "from-pink-500 to-rose-600",
    emoji: "✨",
  },
  {
    id: "fd3",
    title: "Taste the Weekend",
    subtitle: "Food, restaurants & grocery delivery — 18% cashback",
    cashback: 18,
    endsIn: "11:59:59",
    sold: 43,
    color: "from-orange-500 to-amber-600",
    emoji: "🍽️",
  },
];

const FEATURED_DEALS = [
  {
    id: "d1",
    store: "Aarong",
    offer: "Up to 25% cashback on handloom & crafts",
    tag: "Fashion",
    rating: 4.8,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "d2",
    store: "Daraz",
    offer: "12% cashback on electronics & gadgets",
    tag: "Electronics",
    rating: 4.6,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "d3",
    store: "Shajgoj",
    offer: "15% cashback on all beauty orders above ৳500",
    tag: "Beauty",
    rating: 4.7,
    color: "bg-pink-50 text-pink-700 border-pink-200",
  },
  {
    id: "d4",
    store: "North End Coffee",
    offer: "10% cashback + free delivery this week",
    tag: "Food",
    rating: 4.9,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "d5",
    store: "Pathao Food",
    offer: "20% cashback on orders above ৳300",
    tag: "Food",
    rating: 4.5,
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    id: "d6",
    store: "The Palace Resort",
    offer: "15% cashback on weekend getaways",
    tag: "Travel",
    rating: 4.8,
    color: "bg-sky-50 text-sky-700 border-sky-200",
  },
];

function MerchantPromoDeals() {
  const { data, isLoading } = useListPromoDeals();
  const deals = data ?? [];
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">Merchant Campaigns</h2>
        {deals.length > 0 && (
          <Badge className="bg-red-100 text-red-700 border-none uppercase text-[10px]">
            {deals.length} live
          </Badge>
        )}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : deals.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No merchant campaigns are live right now — check back soon.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deals.map((deal) => (
            <Card key={deal.id} className="border-border/60 hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0 font-black text-lg">
                  -{Math.round(deal.discountPercent)}%
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{deal.title}</span>
                    {deal.featured && (
                      <Badge className="bg-yellow-100 text-yellow-700 border-none text-[10px] uppercase">
                        Featured
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                    {deal.description || `${Math.round(deal.discountPercent)}% off at ${deal.storeName}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{deal.storeName}</span>
                    <span>·</span>
                    <Clock className="w-3 h-3" />
                    <span>
                      Ends {new Intl.DateTimeFormat("en-BD", { month: "short", day: "numeric" }).format(new Date(deal.endsAt))}
                    </span>
                  </div>
                </div>
                <Link href="/products">
                  <ArrowRight className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors shrink-0" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Deals() {
  const { data, isLoading } = useGetMarketplaceSummary();

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-10 animate-in">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold mb-2">
          <Flame className="w-4 h-4" />
          Hot Deals
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Today's best offers</h1>
        <p className="text-muted-foreground mt-1">Time-limited cashback boosts across top stores.</p>
      </div>

      {/* Flash deals */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500 fill-yellow-400" />
          <h2 className="text-xl font-bold">Flash Deals</h2>
          <Badge className="bg-destructive text-destructive-foreground uppercase text-[10px] tracking-widest">Live now</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FLASH_DEALS.map((deal) => (
            <div
              key={deal.id}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${deal.color} text-white p-6 flex flex-col gap-4`}
            >
              <div className="text-3xl">{deal.emoji}</div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg leading-tight">{deal.title}</h3>
                <p className="text-white/80 text-sm leading-relaxed">{deal.subtitle}</p>
              </div>
              <div className="flex items-center gap-3 mt-auto">
                <div className="flex flex-col">
                  <span className="text-white/70 text-xs uppercase tracking-wide">Cashback</span>
                  <span className="text-3xl font-black">{deal.cashback}%</span>
                </div>
                <div className="flex-1 text-right">
                  <div className="text-white/70 text-xs flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" /> Ends in
                  </div>
                  <div className="font-mono font-bold text-sm">{deal.endsIn}</div>
                  <div className="text-white/60 text-xs mt-0.5">{deal.sold}% claimed</div>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1.5">
                <div className="bg-white h-1.5 rounded-full" style={{ width: `${deal.sold}%` }} />
              </div>
              <Link href="/products">
                <Button className="w-full bg-white text-black hover:bg-white/90 font-bold gap-1">
                  Claim Deal <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            </div>
          ))}
        </div>
      </section>

      {/* Live cashback deals from API */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Live Cashback Events</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data?.deals.map((deal) => (
              <Card key={deal.id} className="overflow-hidden border-border/60 hover:shadow-md transition-all">
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base">{deal.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{deal.subtitle}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-2xl font-black text-primary">{deal.cashbackPercent}%</div>
                      <div className="text-xs text-muted-foreground">cashback</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Ends {new Intl.DateTimeFormat("en-BD", { month: "short", day: "numeric" }).format(new Date(deal.endsAt))}</span>
                  </div>
                  <Link href="/products">
                    <Button variant="outline" className="w-full gap-1" size="sm">
                      Shop now <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Live merchant promotional deals */}
      <MerchantPromoDeals />

      {/* Store deals */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Store Cashback Offers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURED_DEALS.map((deal) => (
            <Card key={deal.id} className="border-border/60 hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 font-bold text-lg ${deal.color}`}>
                  {deal.store.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{deal.store}</span>
                    <Badge variant="outline" className="text-[10px]">{deal.tag}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{deal.offer}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-secondary font-medium">
                    <Star className="w-3 h-3 fill-secondary" />
                    {deal.rating}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
