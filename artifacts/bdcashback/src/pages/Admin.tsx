import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck, Store, Ticket, Flame, Users, Gift, Percent,
  Wallet, ShoppingBag, Clock, FileText,
} from "lucide-react";
import {
  useGetAdminMe,
  useClaimAdmin,
  getGetAdminMeQueryKey,
} from "@workspace/api-client-react";
import MerchantsTab from "@/components/admin/MerchantsTab";
import CouponsTab from "@/components/admin/CouponsTab";
import DealsTab from "@/components/admin/DealsTab";
import GroupBuysTab from "@/components/admin/GroupBuysTab";
import GiftCardsTab from "@/components/admin/GiftCardsTab";
import FeeRulesTab from "@/components/admin/FeeRulesTab";
import WithdrawalsTab from "@/components/admin/WithdrawalsTab";
import AdminOrdersTab from "@/components/admin/AdminOrdersTab";
import CashbackQueueTab from "@/components/admin/CashbackQueueTab";
import AuditLogsTab from "@/components/admin/AuditLogsTab";

export default function Admin() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useGetAdminMe({
    query: {
      queryKey: getGetAdminMeQueryKey(),
      enabled: Boolean(isLoaded && isSignedIn),
      retry: false,
    },
  });
  const claim = useClaimAdmin();

  if (!isLoaded || (isSignedIn && isLoading)) {
    return <div className="container mx-auto px-4 py-10"><Skeleton className="h-64 rounded-xl" /></div>;
  }

  if (!isSignedIn) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-extrabold">Admin panel</h1>
        <p className="text-muted-foreground">Sign in to access platform administration.</p>
        <Link href="/sign-in"><Button>Sign in</Button></Link>
      </div>
    );
  }

  if (!me?.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-extrabold">Admin panel</h1>
        {me?.canClaim ? (
          <>
            <p className="text-muted-foreground max-w-md mx-auto">
              No administrator exists yet. As the first user, you can claim the admin seat for this platform.
            </p>
            <Button
              disabled={claim.isPending}
              onClick={() =>
                claim.mutate(undefined, {
                  onSuccess: () => void queryClient.invalidateQueries({ queryKey: getGetAdminMeQueryKey() }),
                })
              }
            >
              {claim.isPending ? "Claiming..." : "Claim admin access"}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">You don't have admin access to this platform.</p>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 space-y-6 animate-in">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-2">
          <ShieldCheck className="w-4 h-4" /> Platform Admin
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Admin panel</h1>
        <p className="text-muted-foreground mt-1">Moderate merchants, promotions, gift cards and fee rules.</p>
      </div>

      <Tabs defaultValue="withdrawals">
        <TabsList className="flex-wrap h-auto gap-y-1">
          <TabsTrigger value="withdrawals" className="gap-1.5"><Wallet className="w-4 h-4" /> Withdrawals</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5"><ShoppingBag className="w-4 h-4" /> Orders</TabsTrigger>
          <TabsTrigger value="cashback" className="gap-1.5"><Clock className="w-4 h-4" /> Cashback Queue</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><FileText className="w-4 h-4" /> Audit Logs</TabsTrigger>
          <TabsTrigger value="merchants" className="gap-1.5"><Store className="w-4 h-4" /> Merchants</TabsTrigger>
          <TabsTrigger value="coupons" className="gap-1.5"><Ticket className="w-4 h-4" /> Coupons</TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5"><Flame className="w-4 h-4" /> Deals</TabsTrigger>
          <TabsTrigger value="group-buys" className="gap-1.5"><Users className="w-4 h-4" /> Group Buys</TabsTrigger>
          <TabsTrigger value="gift-cards" className="gap-1.5"><Gift className="w-4 h-4" /> Gift Cards</TabsTrigger>
          <TabsTrigger value="fees" className="gap-1.5"><Percent className="w-4 h-4" /> Fee Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="withdrawals" className="mt-4"><WithdrawalsTab /></TabsContent>
        <TabsContent value="orders" className="mt-4"><AdminOrdersTab /></TabsContent>
        <TabsContent value="cashback" className="mt-4"><CashbackQueueTab /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditLogsTab /></TabsContent>
        <TabsContent value="merchants" className="mt-4"><MerchantsTab /></TabsContent>
        <TabsContent value="coupons" className="mt-4"><CouponsTab /></TabsContent>
        <TabsContent value="deals" className="mt-4"><DealsTab /></TabsContent>
        <TabsContent value="group-buys" className="mt-4"><GroupBuysTab /></TabsContent>
        <TabsContent value="gift-cards" className="mt-4"><GiftCardsTab /></TabsContent>
        <TabsContent value="fees" className="mt-4"><FeeRulesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
