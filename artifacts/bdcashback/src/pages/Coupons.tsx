import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, Copy, CheckCheck, Search, Clock, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const COUPONS = [
  {
    id: "WELCOME20",
    code: "WELCOME20",
    title: "Welcome Discount",
    description: "20% off your first purchase at any partner store",
    discount: "20% OFF",
    minSpend: 500,
    expiresAt: "2026-08-31",
    category: "All Stores",
    color: "from-violet-500 to-purple-600",
    badge: "New User",
  },
  {
    id: "FOOD15",
    code: "FOOD15",
    title: "Food & Dining Special",
    description: "Extra 15% cashback on all food orders this week",
    discount: "15% CB",
    minSpend: 300,
    expiresAt: "2026-08-07",
    category: "Food & Dining",
    color: "from-orange-400 to-red-500",
    badge: "Hot",
  },
  {
    id: "TECH500",
    code: "TECH500",
    title: "Electronics Flat Off",
    description: "৳500 instant discount on electronics above ৳10,000",
    discount: "৳500 OFF",
    minSpend: 10000,
    expiresAt: "2026-08-15",
    category: "Electronics",
    color: "from-blue-500 to-cyan-600",
    badge: null,
  },
  {
    id: "BEAUTY10",
    code: "BEAUTY10",
    title: "Beauty & Skincare",
    description: "10% off all beauty products, no minimum spend",
    discount: "10% OFF",
    minSpend: 0,
    expiresAt: "2026-08-20",
    category: "Beauty",
    color: "from-pink-400 to-rose-500",
    badge: "Limited",
  },
  {
    id: "FASHION25",
    code: "FASHION25",
    title: "Style Season Sale",
    description: "25% cashback on fashion items from Aarong & partners",
    discount: "25% CB",
    minSpend: 1000,
    expiresAt: "2026-08-09",
    category: "Fashion",
    color: "from-teal-500 to-emerald-600",
    badge: "Ending soon",
  },
  {
    id: "TRAVEL8",
    code: "TRAVEL8",
    title: "Travel & Getaway",
    description: "8% cashback on hotel and resort bookings",
    discount: "8% CB",
    minSpend: 5000,
    expiresAt: "2026-09-30",
    category: "Travel",
    color: "from-sky-400 to-blue-600",
    badge: null,
  },
];

export default function Coupons() {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = COUPONS.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold mb-2">
            <Ticket className="w-4 h-4" />
            Coupons & Promo Codes
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Save more, earn more</h1>
          <p className="text-muted-foreground mt-1">Exclusive promo codes to stack on top of your cashback.</p>
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

      {/* Coupons grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Ticket className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">No coupons found</h3>
          <p className="text-muted-foreground mt-1">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((coupon) => (
            <Card key={coupon.id} className="overflow-hidden border-border/60 hover:shadow-md transition-all">
              {/* Color band */}
              <div className={cn("h-2 w-full bg-gradient-to-r", coupon.color)} />
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{coupon.discount}</span>
                      {coupon.badge && (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                          {coupon.badge}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm leading-tight">{coupon.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{coupon.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{coupon.category}</span>
                  {coupon.minSpend > 0 && (
                    <>
                      <span>·</span>
                      <span>Min. ৳{coupon.minSpend.toLocaleString()}</span>
                    </>
                  )}
                  <span>·</span>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Expires {formatDate(coupon.expiresAt)}</span>
                </div>

                {/* Code copy row */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/40 bg-primary/5">
                    <Ticket className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-mono font-bold text-sm tracking-widest text-primary flex-1">{coupon.code}</span>
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
