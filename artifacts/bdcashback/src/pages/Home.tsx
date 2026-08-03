import { Skeleton } from "@/components/ui/skeleton";
import { useGetMarketplaceSummary } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ChevronRight, Percent, Clock, Sparkles, Wallet as WalletIcon, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/utils";

const dealAccents: Record<string, string> = {
  violet: "linear-gradient(135deg, #d946ef, #a855f7)",
  coral: "linear-gradient(135deg, #ff7a59, #f97316)",
  mint: "linear-gradient(135deg, #0f9f8f, #087f73)",
};

function formatDealDate(value: string) {
  return new Intl.DateTimeFormat("en-BD", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function Home() {
  const { data, isLoading, isError } = useGetMarketplaceSummary();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 md:py-10 space-y-8 animate-in">
        <Skeleton className="w-full h-48 rounded-2xl" />
        
        <div className="space-y-4">
          <Skeleton className="w-48 h-8 rounded-lg" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="min-w-24 h-28 rounded-2xl flex-shrink-0" />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="w-48 h-8 rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-2">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">Oops, something went wrong.</h2>
        <p className="text-muted-foreground max-w-md">We couldn't load the marketplace right now. Please try again later.</p>
        <Button onClick={() => window.location.reload()}>Refresh Page</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-12 animate-in">
      
      {/* Hero / Wallet Snapshot */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-teal-800 text-white p-6 md:p-10 shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-sm font-medium mb-2">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span>Double Points Weekend is ON!</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Make every Taka count with smart cashback.
            </h1>
            <p className="text-teal-100 font-medium text-lg">
              Shop your favorite brands and build your rewards balance effortlessly.
            </p>
          </div>

          <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white min-w-[280px]">
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-teal-100 font-medium">Your Balance</span>
                <WalletIcon className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <div className="text-3xl font-black">{formatCurrency(data.wallet.balance)}</div>
                <div className="text-sm text-teal-100 flex items-center gap-1 mt-1">
                  <TrendingUp className="w-4 h-4 text-secondary" />
                  <span>{formatCurrency(data.wallet.pendingCashback)} pending</span>
                </div>
              </div>
              <Link href="/wallet" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all disabled:pointer-events-none disabled:opacity-50 w-full h-11 bg-white text-primary hover:bg-white/90 shadow-sm mt-2">
                View Wallet
              </Link>
            </CardContent>
          </Card>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-teal-500/30 rounded-full blur-2xl pointer-events-none" />
      </section>

      {/* Categories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold">Shop by Category</h2>
          <Link href="/products" className="text-sm font-semibold text-primary flex items-center hover:underline">
            See all <ChevronRight className="w-4 h-4 ml-0.5" />
          </Link>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
          {data.categories.map((category) => (
            <Link 
              key={category.id} 
              href={`/products?category=${category.id}`}
              className="group flex flex-col items-center justify-center min-w-[100px] gap-3 p-4 rounded-2xl bg-card border hover:border-primary/50 hover:shadow-md transition-all snap-start"
            >
              <div className="w-14 h-14 rounded-full bg-accent text-primary flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                {/* Fallback to simple letter if icon mapping isn't available, but we'll use an image or style */}
                <span className="font-bold">{category.name.charAt(0)}</span>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold whitespace-nowrap">{category.name}</div>
                <div className="text-xs text-muted-foreground">{category.productCount} items</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Hot Deals */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl md:text-2xl font-bold">Hot Deals</h2>
          <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive uppercase tracking-widest text-[10px]">Ending soon</Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.deals.map((deal) => (
            <div 
              key={deal.id}
              className="relative overflow-hidden rounded-2xl p-6 text-white"
              style={{ background: dealAccents[deal.accent] ?? dealAccents.mint }}
            >
              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <div>
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-none mb-3 backdrop-blur-sm">
                    <Clock className="w-3 h-3 mr-1" />
                    Ends {formatDealDate(deal.endsAt)}
                  </Badge>
                  <h3 className="text-2xl font-bold leading-tight">{deal.title}</h3>
                  <p className="text-white/80 text-sm mt-1">{deal.subtitle}</p>
                </div>
                
                <div className="flex items-end justify-between mt-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-white/80 uppercase tracking-wider font-semibold">Cashback</span>
                    <span className="text-3xl font-black">{deal.cashbackPercent}%</span>
                  </div>
                  <Link href="/products" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all h-9 px-4 bg-white text-black hover:bg-white/90">
                    Claim Deal
                  </Link>
                </div>
              </div>
              {/* Decorative graphic per deal */}
              <div className="absolute right-[-10%] bottom-[-10%] w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            </div>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold">Featured Offers</h2>
          <Link href="/products" className="text-sm font-semibold text-primary flex items-center hover:underline">
            View more <ChevronRight className="w-4 h-4 ml-0.5" />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.featuredProducts.map((product) => (
            <Link key={product.id} href={`/products`} className="group flex flex-col h-full">
              <Card className="h-full border-border/60 hover:border-primary/50 hover:shadow-md transition-all flex flex-col overflow-hidden">
                <div className="relative aspect-square p-4 bg-accent/30 flex items-center justify-center overflow-hidden">
                  {product.badge && (
                    <Badge className="absolute top-2 left-2 z-10 bg-secondary text-secondary-foreground">
                      {product.badge}
                    </Badge>
                  )}
                  <Badge variant="cashback" className="absolute top-2 right-2 z-10 font-bold">
                    {product.cashbackPercent}% CB
                  </Badge>
                  {/* Image placeholder with subtle branding */}
                  <div className="w-3/4 h-3/4 rounded-xl bg-white shadow-sm flex items-center justify-center relative transform group-hover:scale-105 transition-transform duration-500">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-muted-foreground/30 font-bold text-4xl">{product.brand.charAt(0)}</div>
                    )}
                  </div>
                </div>
                <CardContent className="p-4 flex flex-col flex-1 gap-1">
                  <div className="text-xs text-muted-foreground font-medium">{product.brand} • {product.merchant}</div>
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1 group-hover:text-primary transition-colors">{product.name}</h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-bold text-base">{formatCurrency(product.price)}</span>
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
      
    </div>
  );
}
