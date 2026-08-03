import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket, Copy, CheckCheck, Search, Clock, Tag, Store } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useListPublicCoupons, type Coupon } from "@workspace/api-client-react";

const COLORS = [
  "from-violet-500 to-purple-600",
  "from-orange-400 to-red-500",
  "from-blue-500 to-cyan-600",
  "from-pink-400 to-rose-500",
  "from-teal-500 to-emerald-600",
  "from-sky-400 to-blue-600",
];

function colorFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function discountLabel(coupon: Coupon) {
  return coupon.discountType === "percent"
    ? `${coupon.discountValue}% OFF`
    : `${formatCurrency(coupon.discountValue)} OFF`;
}

export default function Coupons() {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useListPublicCoupons();

  const coupons = data ?? [];
  const filtered = coupons.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.storeName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  function copy(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  function formatDate(d: string) {
    return new Intl.DateTimeFormat("en-BD", { month: "short", day: "numeric" }).format(new Date(d));
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold mb-2">
            <Ticket className="w-4 h-4" />
            Coupons & Promo Codes
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Save more, earn more</h1>
          <p className="text-muted-foreground mt-1">
            Live promo codes from BDCashBack and partner stores — apply them at checkout.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search coupons..."
            className="pl-9 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Couldn't load coupons.{" "}
            <button className="underline font-medium" onClick={() => void refetch()}>
              Try again
            </button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Ticket className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">
            {coupons.length === 0 ? "No live coupons right now" : "No coupons found"}
          </h3>
          <p className="text-muted-foreground mt-1">
            {coupons.length === 0
              ? "Check back soon — new codes drop all the time."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((coupon) => (
            <Card key={coupon.id} className="overflow-hidden border-border/60 hover:shadow-md transition-all">
              <div className={cn("h-2 w-full bg-gradient-to-r", colorFor(coupon.id))} />
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{discountLabel(coupon)}</span>
                    {coupon.scope === "global" ? (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        All stores
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Store className="w-3 h-3" /> {coupon.storeName}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm leading-tight">{coupon.title}</h3>
                </div>

                <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
                  {coupon.minOrderValue > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> Min. {formatCurrency(coupon.minOrderValue)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Expires {formatDate(coupon.endsAt)}
                  </span>
                  {coupon.maxUses > 0 && (
                    <span>{Math.max(0, coupon.maxUses - coupon.usedCount)} uses left</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/40 bg-primary/5">
                    <Ticket className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-mono font-bold text-sm tracking-widest text-primary flex-1">
                      {coupon.code}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={copied === coupon.code ? "secondary" : "default"}
                    className="shrink-0 gap-1.5"
                    onClick={() => copy(coupon.code)}
                  >
                    {copied === coupon.code ? (
                      <><CheckCheck className="w-3.5 h-3.5" /> Copied</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copy</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
