import * as React from "react";
import { useState, useMemo } from "react";
import { useListMarketplaceProducts, useListMarketplaceCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Percent, Star } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

export default function Products() {
  const initialCategory = new URLSearchParams(window.location.search).get("category");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: categories, isLoading: categoriesLoading } = useListMarketplaceCategories();
  
  const { data: products, isLoading: productsLoading } = useListMarketplaceProducts({
    search: debouncedSearch || undefined,
    category: selectedCategory || undefined,
  });

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 space-y-6 animate-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Discover</h1>
          <p className="text-muted-foreground mt-1">Find the best cashback deals across all stores.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <Input 
            type="search" 
            placeholder="Search products, brands..." 
            className="w-full md:w-80 bg-white"
            icon={<Search className="w-4 h-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" size="icon" className="shrink-0 md:hidden bg-white">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters (Desktop) */}
        <aside className="hidden md:block w-64 shrink-0 space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Categories</h3>
            {categoriesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    selectedCategory === null ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent"
                  )}
                >
                  All Categories
                </button>
                {categories?.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex justify-between items-center",
                      selectedCategory === cat.id ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent"
                    )}
                  >
                    <span>{cat.name}</span>
                    <span className={cn("text-xs", selectedCategory === cat.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {cat.productCount}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Categories (Horizontal Scroll) */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          <Badge 
            variant={selectedCategory === null ? "default" : "outline"}
            className="shrink-0 px-4 py-1.5 cursor-pointer text-sm"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Badge>
          {!categoriesLoading && categories?.map((cat) => (
            <Badge 
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              className="shrink-0 px-4 py-1.5 cursor-pointer text-sm bg-white"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </Badge>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1">
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <Skeleton key={i} className="h-[280px] rounded-2xl" />
              ))}
            </div>
          ) : products?.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-2xl border border-dashed">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold">No products found</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">Try adjusting your search or filter to find what you're looking for.</p>
              <Button variant="outline" className="mt-6" onClick={() => { setSearch(""); setSelectedCategory(null); }}>
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products?.map((product) => (
                <div key={product.id} className="group flex flex-col h-full cursor-pointer">
                  <Card className="h-full border-border/60 hover:border-primary/50 hover:shadow-md transition-all flex flex-col overflow-hidden bg-white">
                    <div className="relative aspect-square p-4 bg-accent/20 flex items-center justify-center overflow-hidden group-hover:bg-accent/40 transition-colors">
                      {product.badge && (
                        <Badge className="absolute top-2 left-2 z-10 bg-secondary text-secondary-foreground text-[10px] px-2 py-0">
                          {product.badge}
                        </Badge>
                      )}
                      <Badge variant="cashback" className="absolute top-2 right-2 z-10 font-bold shadow-sm">
                        {product.cashbackPercent}% CB
                      </Badge>
                      <div className="w-4/5 h-4/5 rounded-xl bg-white shadow-sm flex items-center justify-center relative transform group-hover:scale-105 transition-transform duration-500">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                        ) : (
                          <div className="text-muted-foreground/20 font-bold text-4xl">{product.brand.charAt(0)}</div>
                        )}
                      </div>
                    </div>
                    
                    <CardContent className="p-4 flex flex-col flex-1 gap-1.5">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{product.brand}</div>
                        <div className="flex items-center gap-0.5 text-secondary font-medium text-[11px]">
                          <Star className="w-3 h-3 fill-secondary" />
                          <span>{product.rating}</span>
                          <span className="text-muted-foreground">({product.reviewCount})</span>
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      
                      <div className="mt-3">
                        <div className="flex flex-col">
                          {product.originalPrice > product.price && (
                            <span className="text-[11px] text-muted-foreground line-through">{formatCurrency(product.originalPrice)}</span>
                          )}
                          <span className="font-extrabold text-lg tracking-tight text-foreground">{formatCurrency(product.price)}</span>
                        </div>
                        <div className="text-xs text-primary font-medium mt-1">
                          via {product.merchant}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
