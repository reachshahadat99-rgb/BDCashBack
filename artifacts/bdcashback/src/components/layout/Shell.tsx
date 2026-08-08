import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { Home, Search, Wallet, User, Bell, Store, Ticket, Flame, Percent, Users, Gift, ChevronDown, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";

const primaryNav = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  { href: "/deals", label: "Deals" },
  { href: "/cashback", label: "Cashback" },
  { href: "/orders", label: "Orders" },
];

const moreNav = [
  { href: "/coupons", icon: Ticket, label: "Coupons" },
  { href: "/group-buy", icon: Users, label: "Group Buy" },
  { href: "/gift-cards", icon: Gift, label: "Gift Cards" },
  { href: "/merchant", icon: Store, label: "Sell on BDCashBack" },
];

const mobileBottomNav = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/products", icon: Search, label: "Shop" },
  { href: "/orders", icon: ShoppingBag, label: "Orders" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
  { href: "/account", icon: User, label: "Account" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Close dropdown on navigation
  useEffect(() => { setMoreOpen(false); }, [location]);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background">
      {/* Desktop Top Navbar */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-border/50 hidden md:block">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-8">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-primary">BDCashBack</span>
          </Link>

          <nav className="flex items-center gap-1">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:text-primary hover:bg-accent",
                  location === item.href ? "text-primary bg-accent" : "text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}

            {/* More dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:text-primary hover:bg-accent",
                  moreOpen ? "text-primary bg-accent" : "text-muted-foreground"
                )}
              >
                More <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", moreOpen && "rotate-180")} />
              </button>
              {moreOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-52 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-50 py-1">
                  {moreNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-primary",
                        location === item.href ? "text-primary bg-accent" : "text-foreground"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/wallet"
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:text-primary hover:bg-accent",
                location === "/wallet" ? "text-primary bg-accent" : "text-muted-foreground"
              )}
            >
              Wallet
            </Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-primary">
              <Bell className="w-5 h-5" />
            </Button>
            {isLoaded && user ? (
              <div className="flex items-center gap-2">
                <Link href="/account" className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold hover:bg-accent transition-colors">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {(user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress[0] ?? "U").toUpperCase()}
                  </span>
                  {user.firstName ?? "Account"}
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ redirectUrl: "/" })}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/sign-in" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold h-9 px-4 hover:bg-accent transition-colors text-foreground border border-border">
                  Sign In
                </Link>
                <Link href="/signup/customer" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all">
                  Sign Up
                </Link>
                <Link href="/signup/merchant" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold h-9 px-4 border border-primary text-primary hover:bg-primary/5 transition-all">
                  Sell on BDCashBack
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Top Header */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-border/50 md:hidden">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-primary">BDCashBack</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/profile">
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
                <User className="w-5 h-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-border/50 pb-safe">
        <div className="flex items-center justify-around h-16 px-1">
          {mobileBottomNav.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          {/* More button on mobile */}
          <div className="relative flex-1" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-16 gap-0.5 transition-colors",
                moreOpen ? "text-primary" : "text-muted-foreground"
              )}
            >
              <ChevronDown className={cn("w-5 h-5 transition-transform", moreOpen && "rotate-180")} />
              <span className="text-[10px] font-medium">More</span>
            </button>
            {moreOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-52 bg-background border border-border rounded-xl shadow-lg overflow-hidden z-50 py-1">
                {[...moreNav, { href: "/cashback", icon: Percent, label: "Cashback" }, { href: "/group-buy", icon: Users, label: "Group Buy" }]
                  .filter((item, idx, arr) => arr.findIndex(a => a.href === item.href) === idx)
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-primary",
                        location === item.href ? "text-primary bg-accent" : "text-foreground"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      {item.label}
                    </Link>
                  ))}
              </div>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
