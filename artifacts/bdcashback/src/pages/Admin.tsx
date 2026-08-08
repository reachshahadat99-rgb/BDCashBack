import { useState } from "react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Store, Ticket, Flame, Users, Gift, Percent,
  Wallet, ShoppingBag, Clock, FileText, LayoutDashboard, CreditCard,
  ChevronRight,
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
import DashboardTab from "@/components/admin/DashboardTab";
import PaymentSettingsTab from "@/components/admin/PaymentSettingsTab";

// ---------------------------------------------------------------------------
// Sidebar nav config
// ---------------------------------------------------------------------------
interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  section?: string; // group header
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },

  // Operations
  { id: "withdrawals", label: "Withdrawals", icon: <Wallet className="w-4 h-4" />, section: "Operations" },
  { id: "orders", label: "Orders", icon: <ShoppingBag className="w-4 h-4" /> },
  { id: "cashback", label: "Cashback Queue", icon: <Clock className="w-4 h-4" /> },

  // Moderation
  { id: "merchants", label: "Merchants", icon: <Store className="w-4 h-4" />, section: "Moderation" },
  { id: "coupons", label: "Coupons", icon: <Ticket className="w-4 h-4" /> },
  { id: "deals", label: "Deals", icon: <Flame className="w-4 h-4" /> },
  { id: "group-buys", label: "Group Buys", icon: <Users className="w-4 h-4" /> },
  { id: "gift-cards", label: "Gift Cards", icon: <Gift className="w-4 h-4" /> },

  // Platform
  { id: "fees", label: "Fee Rules", icon: <Percent className="w-4 h-4" />, section: "Platform" },
  { id: "payment-settings", label: "Payment Settings", icon: <CreditCard className="w-4 h-4" /> },
  { id: "audit", label: "Audit Logs", icon: <FileText className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
interface SidebarProps {
  active: string;
  onSelect: (id: string) => void;
}

function Sidebar({ active, onSelect }: SidebarProps) {
  let lastSection = "";
  return (
    <nav className="flex flex-col gap-0.5 min-w-[200px] w-[200px] shrink-0">
      {NAV.map((item) => {
        const showSection = item.section && item.section !== lastSection;
        if (item.section) lastSection = item.section;
        return (
          <div key={item.id}>
            {showSection && (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pt-4 pb-1">
                {item.section}
              </p>
            )}
            <button
              onClick={() => onSelect(item.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                active === item.id
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {active === item.id && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Content router
// ---------------------------------------------------------------------------
function TabContent({ tab, onNavigate }: { tab: string; onNavigate: (t: string) => void }) {
  const titles: Record<string, string> = {
    dashboard: "Dashboard",
    withdrawals: "Withdrawals",
    orders: "Orders",
    cashback: "Cashback Queue",
    merchants: "Merchants",
    coupons: "Coupons",
    deals: "Deals",
    "group-buys": "Group Buys",
    "gift-cards": "Gift Cards",
    fees: "Fee Rules",
    "payment-settings": "Payment Settings",
    audit: "Audit Logs",
  };

  const descriptions: Record<string, string> = {
    dashboard: "Platform overview — GMV, pending actions, and recent activity.",
    withdrawals: "Review and process merchant withdrawal requests.",
    orders: "Browse and manage all customer orders.",
    cashback: "Release or reject pending cashback rewards.",
    merchants: "Approve, suspend, and manage merchant stores.",
    coupons: "Moderate platform-wide coupon codes.",
    deals: "Moderate flash deals and promotions.",
    "group-buys": "Manage group buy campaigns.",
    "gift-cards": "Manage gift card brands and codes.",
    fees: "Configure platform fee rules.",
    "payment-settings": "Configure payment gateway credentials and modes.",
    audit: "Full audit trail of admin actions.",
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-4">
        <h2 className="text-xl font-extrabold tracking-tight">{titles[tab]}</h2>
        {descriptions[tab] && <p className="text-sm text-muted-foreground mt-0.5">{descriptions[tab]}</p>}
      </div>
      {tab === "dashboard" && <DashboardTab onNavigate={onNavigate} />}
      {tab === "withdrawals" && <WithdrawalsTab />}
      {tab === "orders" && <AdminOrdersTab />}
      {tab === "cashback" && <CashbackQueueTab />}
      {tab === "merchants" && <MerchantsTab />}
      {tab === "coupons" && <CouponsTab />}
      {tab === "deals" && <DealsTab />}
      {tab === "group-buys" && <GroupBuysTab />}
      {tab === "gift-cards" && <GiftCardsTab />}
      {tab === "fees" && <FeeRulesTab />}
      {tab === "payment-settings" && <PaymentSettingsTab />}
      {tab === "audit" && <AuditLogsTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
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
  const [activeTab, setActiveTab] = useState("dashboard");

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
    <div className="container mx-auto px-4 py-6 md:py-8">
      {/* Page header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-2">
          <ShieldCheck className="w-4 h-4" /> Platform Admin
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Admin panel</h1>
        <p className="text-muted-foreground mt-1">Manage the BDCashBack platform.</p>
      </div>

      {/* Sidebar + content */}
      <div className="flex gap-6 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden md:block sticky top-20">
          <Sidebar active={activeTab} onSelect={setActiveTab} />
        </aside>

        {/* Mobile: compact horizontal scroll nav */}
        <div className="md:hidden w-full mb-4 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0 border transition-colors",
                activeTab === item.id
                  ? "bg-primary text-primary-foreground border-transparent font-semibold"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <TabContent tab={activeTab} onNavigate={setActiveTab} />
        </div>
      </div>
    </div>
  );
}
