import { useGetWalletSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Wallet as WalletIcon, Clock, ArrowDownToLine, History, Sparkles, AlertCircle } from "lucide-react";

export default function Wallet() {
  const { data, isLoading, isError } = useGetWalletSummary();

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8 space-y-6 animate-in">
        <h1 className="text-3xl font-extrabold tracking-tight mb-6">My Wallet</h1>
        <Skeleton className="w-full h-64 rounded-3xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="w-full h-64 rounded-2xl mt-8" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-2xl font-bold">Could not load wallet details.</h2>
        <Button onClick={() => window.location.reload()} variant="outline">Try again</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-8 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground mt-1">Manage your balance and rewards.</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-accent text-primary flex items-center justify-center border-2 border-white shadow-sm">
          <WalletIcon className="w-6 h-6" />
        </div>
      </div>

      {/* Main Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-primary text-white p-8 shadow-lg shadow-primary/20">
        <div className="relative z-10">
          <div className="text-primary-foreground/80 font-medium mb-1">Total Available Balance</div>
          <div className="text-5xl font-black tracking-tight mb-8">
            {formatCurrency(data.balance)}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button className="bg-white text-primary hover:bg-white/90 rounded-xl h-12 px-8 font-bold flex-1 sm:flex-none">
              <ArrowDownToLine className="w-5 h-5 mr-2" />
              Withdraw
            </Button>
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-xl h-12 px-8 font-semibold flex-1 sm:flex-none">
              Transfer to Bank
            </Button>
          </div>
        </div>

        {/* Decorative pattern */}
        <div className="absolute right-0 top-0 w-64 h-full opacity-10 pointer-events-none">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-current">
            <circle cx="80" cy="20" r="40" />
            <circle cx="90" cy="80" r="30" />
            <circle cx="20" cy="90" r="20" />
          </svg>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Pending Cashback</div>
              <div className="text-2xl font-bold">{formatCurrency(data.pendingCashback)}</div>
              <p className="text-xs text-muted-foreground mt-2">Clears automatically within 30 days after merchant verification.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary/20 text-secondary-foreground flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">Reward Points</div>
              <div className="text-2xl font-bold text-secondary-foreground">{formatNumber(data.rewardPoints)} <span className="text-sm font-medium text-muted-foreground">pts</span></div>
              <p className="text-xs text-muted-foreground mt-2">Redeemable for exclusive deals and extra cashback boosts.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Stub */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Activity</h2>
          <Button variant="ghost" size="sm" className="text-primary font-semibold">
            View All
          </Button>
        </div>
        
        <Card className="bg-white overflow-hidden">
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center bg-accent/30 rounded-2xl border border-dashed border-border/60 mx-4 my-4">
            <History className="w-10 h-10 mb-3 opacity-20" />
            <p className="font-medium text-sm">No recent transactions.</p>
            <p className="text-xs mt-1">Start shopping to earn cashback!</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
