import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  useListAdminOrders,
  useListAdminWithdrawals,
  useListAdminCashbackQueue,
  useListAdminAuditLogs,
  useListAdminMerchants,
  useListAdminCoupons,
  useListAdminDeals,
  useListAdminGroupBuys,
} from "@workspace/api-client-react";
import {
  ShoppingBag, Wallet, Clock, Store, Ticket, Flame, Users, TrendingUp, AlertTriangle,
} from "lucide-react";
import { formatCurrency, fmtDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Build last-30-days GMV chart data from order list
// ---------------------------------------------------------------------------
function buildChartData(orders: Array<{ createdAt: string; total: number }>) {
  const buckets: Record<string, number> = {};
  const now = Date.now();
  // initialise all 30 days to 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const o of orders) {
    const day = o.createdAt.slice(0, 10);
    if (day in buckets) buckets[day] = (buckets[day] ?? 0) + o.total;
  }
  return Object.entries(buckets).map(([date, gmv]) => ({ date: date.slice(5), gmv }));
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
  onClick?: () => void;
  alert?: boolean;
}
function StatCard({ label, value, icon, sub, onClick, alert }: StatCardProps) {
  return (
    <Card
      className={`cursor-default transition-shadow ${onClick ? "cursor-pointer hover:shadow-md" : ""} ${alert ? "border-yellow-300 bg-yellow-50/50" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg ${alert ? "bg-yellow-100 text-yellow-700" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
          <p className="text-2xl font-extrabold leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {alert && <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-1" />}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
interface DashboardTabProps {
  onNavigate: (tab: string) => void;
}

export default function DashboardTab({ onNavigate }: DashboardTabProps) {
  const { data: orders, isLoading: oLoading } = useListAdminOrders();
  const { data: withdrawals, isLoading: wLoading } = useListAdminWithdrawals();
  const { data: cashback, isLoading: cLoading } = useListAdminCashbackQueue();
  const { data: auditLogs, isLoading: aLoading } = useListAdminAuditLogs({ limit: 10 });
  const { data: merchants, isLoading: mLoading } = useListAdminMerchants();
  const { data: coupons } = useListAdminCoupons();
  const { data: deals } = useListAdminDeals();
  const { data: groupBuys } = useListAdminGroupBuys();

  const loading = oLoading || wLoading || cLoading || mLoading;

  // KPIs
  const gmv = (orders ?? []).reduce((s, o) => s + (o.total ?? 0), 0);
  const pendingWithdrawals = (withdrawals ?? []).filter((w) => w.status === "pending").length;
  const pendingCashback = (cashback ?? []).length;
  const pendingMerchants = (merchants ?? []).filter((m) => m.status === "pending").length;
  const activeCoupons = (coupons ?? []).filter((c) => c.status === "active").length;
  const activeDeals = (deals ?? []).filter((d) => d.status === "active").length;
  const activeGroupBuys = (groupBuys ?? []).filter((g) => g.status === "active").length;
  const ordersByStatus: Record<string, number> = {};
  for (const o of (orders ?? [])) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
  }

  const chartData = buildChartData(orders ?? []);

  const statusColors: Record<string, string> = {
    paid: "bg-blue-100 text-blue-700",
    processing: "bg-yellow-100 text-yellow-700",
    shipped: "bg-indigo-100 text-indigo-700",
    delivered: "bg-teal-100 text-teal-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    refunded: "bg-slate-100 text-slate-700",
  };

  const actionColor = (action: string) => {
    if (action.includes("reject") || action.includes("cancel") || action.includes("delete")) return "bg-red-100 text-red-700";
    if (action.includes("approve") || action.includes("complete") || action.includes("create")) return "bg-green-100 text-green-700";
    return "bg-blue-100 text-blue-700";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total GMV (all time)"
          value={formatCurrency(gmv)}
          icon={<TrendingUp className="w-5 h-5" />}
          sub={`${(orders ?? []).length} orders`}
        />
        <StatCard
          label="Pending Withdrawals"
          value={pendingWithdrawals}
          icon={<Wallet className="w-5 h-5" />}
          onClick={() => onNavigate("withdrawals")}
          alert={pendingWithdrawals > 0}
          sub="Click to review"
        />
        <StatCard
          label="Cashback Pending"
          value={pendingCashback}
          icon={<Clock className="w-5 h-5" />}
          onClick={() => onNavigate("cashback")}
          alert={pendingCashback > 0}
          sub="Awaiting release"
        />
        <StatCard
          label="Merchants Pending"
          value={pendingMerchants}
          icon={<Store className="w-5 h-5" />}
          onClick={() => onNavigate("merchants")}
          alert={pendingMerchants > 0}
          sub="Awaiting approval"
        />
        <StatCard
          label="Active Coupons"
          value={activeCoupons}
          icon={<Ticket className="w-5 h-5" />}
          onClick={() => onNavigate("coupons")}
        />
        <StatCard
          label="Active Deals"
          value={activeDeals}
          icon={<Flame className="w-5 h-5" />}
          onClick={() => onNavigate("deals")}
        />
        <StatCard
          label="Active Group Buys"
          value={activeGroupBuys}
          icon={<Users className="w-5 h-5" />}
          onClick={() => onNavigate("group-buys")}
        />
        <StatCard
          label="Total Orders"
          value={(orders ?? []).length}
          icon={<ShoppingBag className="w-5 h-5" />}
          onClick={() => onNavigate("orders")}
          sub="All statuses"
        />
      </div>

      {/* GMV chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">GMV — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), "GMV"]} />
              <Area
                type="monotone"
                dataKey="gmv"
                stroke="hsl(var(--primary))"
                fill="url(#gmvGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Orders by status + recent audit log */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Orders by status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Object.entries(ordersByStatus).length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                Object.entries(ordersByStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge className={`${statusColors[status] ?? "bg-slate-100 text-slate-600"} border-none capitalize text-xs`}>
                        {status}
                      </Badge>
                      <span className="font-bold text-sm">{count}</span>
                    </div>
                  ))
              )}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => onNavigate("orders")}>
              View all orders
            </Button>
          </CardContent>
        </Card>

        {/* Recent audit log */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Recent Audit Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {aLoading ? (
              <Skeleton className="h-40 m-4 rounded-lg" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Target</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditLogs ?? []).slice(0, 8).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="py-1.5">
                        <Badge className={`${actionColor(log.action)} border-none text-xs`}>{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-1.5">
                        {log.targetType}/{log.targetId.slice(0, 6)}…
                      </TableCell>
                      <TableCell className="text-xs py-1.5">{fmtDate(log.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {(auditLogs ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">
                        No audit entries yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            <div className="p-3">
              <Button variant="outline" size="sm" className="w-full" onClick={() => onNavigate("audit")}>
                Full audit log
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
