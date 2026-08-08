/**
 * AdminStoreView — full merchant-parity store management for admins.
 *
 * Tabs: Summary · Products (add/edit/delete) · Orders · Promotions (Coupons / Deals / Group Buys)
 * All mutations hit /api/admin/stores/:storeId/... and are written to the audit log.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, useListMarketplaceCategories } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldAlert, ArrowLeft, Package, ShoppingBag, BarChart2, Plus, Pencil, Trash2,
  Image as ImageIcon, Ticket, Flame, Users, Megaphone,
} from "lucide-react";
import { formatCurrency, fmtDate } from "@/lib/utils";
import { statusBadge } from "./admin-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  cashbackPercent: number;
  stock: number;
  available: boolean;
  status: string;
  categoryId: string;
  imageUrl: string;
  description: string;
  createdAt: string;
}

interface Order {
  id: string;
  status: string;
  total: number;
  cashback: number;
  createdAt: string;
}

interface StoreSummary {
  store: { id: string; name: string; status: string };
  productCount: number;
  totalRevenue: number;
  totalCashback: number;
  orderCount: number;
  recentOrders: Order[];
}

interface CouponRow {
  id: string;
  code: string;
  title: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrderValue: number;
  maxUses: number;
  usedCount: number;
  status: string;
  startsAt: string;
  endsAt: string;
}

interface DealRow {
  id: string;
  title: string;
  description: string;
  discountPercent: number;
  status: string;
  featured: boolean;
  startsAt: string;
  endsAt: string;
}

interface GroupBuyRow {
  id: string;
  title: string;
  category: string;
  originalPrice: number;
  groupPrice: number;
  cashbackPercent: number;
  depositPercent: number;
  minParticipants: number;
  joinedCount: number;
  depositCollected: number;
  approvalStatus: string;
  endsAt: string;
}

// ---------------------------------------------------------------------------
// Query key helpers
// ---------------------------------------------------------------------------
const productsQK = (s: string) => ["admin", "stores", s, "products"] as const;
const ordersQK = (s: string) => ["admin", "stores", s, "orders"] as const;
const summaryQK = (s: string) => ["admin", "stores", s, "summary"] as const;
const couponsQK = (s: string) => ["admin", "stores", s, "coupons"] as const;
const dealsQK = (s: string) => ["admin", "stores", s, "deals"] as const;
const groupBuysQK = (s: string) => ["admin", "stores", s, "group-buys"] as const;

const apiFetch = <T,>(url: string, init?: RequestInit) =>
  customFetch<T>(url, init as Parameters<typeof customFetch>[1]);

// ---------------------------------------------------------------------------
// ORDER_STATUS colors
// ---------------------------------------------------------------------------
const ORDER_STATUS_COLORS: Record<string, string> = {
  paid: "bg-blue-100 text-blue-700",
  processing: "bg-yellow-100 text-yellow-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-teal-100 text-teal-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-slate-100 text-slate-700",
};

// ---------------------------------------------------------------------------
// Product dialog (add / edit)
// ---------------------------------------------------------------------------
type ProductForm = {
  categoryId: string; name: string; description: string; brand: string;
  price: string; originalPrice: string; cashbackPercent: string;
  imageUrl: string; stock: string; available: boolean;
};
const blankProduct: ProductForm = {
  categoryId: "", name: "", description: "", brand: "",
  price: "", originalPrice: "", cashbackPercent: "5",
  imageUrl: "", stock: "0", available: true,
};

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
  storeId: string;
  onSaved: () => void;
}

function ProductDialog({ open, onOpenChange, product, storeId, onSaved }: ProductDialogProps) {
  const { data: categories } = useListMarketplaceCategories();
  const [form, setForm] = useState<ProductForm>(blankProduct);
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const editing = Boolean(product);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        brand: product.brand,
        price: String(product.price),
        originalPrice: String(product.originalPrice),
        cashbackPercent: String(product.cashbackPercent),
        imageUrl: product.imageUrl,
        stock: String(product.stock),
        available: product.available,
      });
    } else {
      setForm({ ...blankProduct, categoryId: categories?.[0]?.id ?? "" });
    }
    setError("");
  }, [open, product, categories]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (product) {
        return apiFetch(`/api/admin/stores/${storeId}/products/${product.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch(`/api/admin/stores/${storeId}/products`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productsQK(storeId) });
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => setError(e.message || "Could not save product."),
  });

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    const payload = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      description: form.description.trim(),
      brand: form.brand.trim(),
      price: Number(form.price),
      originalPrice: Number(form.originalPrice),
      cashbackPercent: Number(form.cashbackPercent),
      imageUrl: form.imageUrl.trim(),
      stock: Number(form.stock),
      available: form.available,
    };
    if (!payload.categoryId || !payload.name || !payload.brand) {
      setError("Category, product name and brand are required.");
      return;
    }
    saveMutation.mutate(payload);
  }

  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add a product"}</DialogTitle>
          <DialogDescription>
            {editing ? "Changes are logged to the admin audit trail." : "New product is added on behalf of this store."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Product name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Handwoven Cotton Saree" maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label>Brand</Label>
              <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Brand or maker" />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Select a category</option>
                {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Selling price (BDT)</Label>
              <Input type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Original price (BDT)</Label>
              <Input type="number" min="0.01" step="0.01" value={form.originalPrice} onChange={(e) => set("originalPrice", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Cashback offer (%)</Label>
              <Input type="number" min="0" max="100" step="0.5" value={form.cashbackPercent} onChange={(e) => set("cashbackPercent", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Stock</Label>
              <Input type="number" min="0" step="1" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Image URL</Label>
              <div className="flex gap-2">
                <Input type="url" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://..." />
                {form.imageUrl
                  ? <img src={form.imageUrl} alt="" className="h-10 w-10 rounded-lg border object-cover shrink-0" />
                  : <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground shrink-0"><ImageIcon className="h-4 w-4" /></div>}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={1000} />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3">
            <input type="checkbox" checked={form.available} onChange={(e) => set("available", e.target.checked)} className="h-4 w-4 accent-primary" />
            <div>
              <p className="text-sm font-semibold">Available for sale</p>
              <p className="text-xs text-muted-foreground">Uncheck to hide without deleting.</p>
            </div>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Products tab
// ---------------------------------------------------------------------------
function ProductsTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: productsQK(storeId),
    queryFn: () => apiFetch<Product[]>(`/api/admin/stores/${storeId}/products`),
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/stores/${storeId}/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productsQK(storeId) });
      setConfirmDelete(null);
    },
  });

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setDialogOpen(true); };

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add product
        </Button>
      </div>

      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Product</TableHead><TableHead>Price</TableHead>
              <TableHead>Cashback</TableHead><TableHead>Stock</TableHead>
              <TableHead>Status</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover border shrink-0" />
                        : <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-4 h-4 text-muted-foreground" /></div>}
                      <div>
                        <p className="font-medium text-sm leading-tight max-w-[180px] truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.brand}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">{formatCurrency(p.price)}</TableCell>
                  <TableCell className="text-green-600 font-semibold">{p.cashbackPercent}%</TableCell>
                  <TableCell className={p.stock === 0 ? "text-red-600 font-semibold" : ""}>{p.stock}</TableCell>
                  <TableCell>{statusBadge(p.available ? "active" : "archived")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(p)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No products yet. <button className="text-primary underline" onClick={openAdd}>Add the first one.</button>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        storeId={storeId}
        onSaved={() => void qc.invalidateQueries({ queryKey: productsQK(storeId) })}
      />

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete product?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <strong>{confirmDelete?.name}</strong>? This is logged and cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Orders tab
// ---------------------------------------------------------------------------
function OrdersTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ordersQK(storeId),
    queryFn: () => apiFetch<Order[]>(`/api/admin/stores/${storeId}/orders`),
  });
  const [selected, setSelected] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [reason, setReason] = useState("");

  const updateStatus = useMutation({
    mutationFn: ({ id, status, reason: r }: { id: string; status: string; reason: string }) =>
      apiFetch(`/api/admin/stores/${storeId}/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason: r }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ordersQK(storeId) });
      setSelected(null); setNewStatus(""); setReason("");
    },
  });

  const STATUS_OPTIONS = ["paid", "processing", "shipped", "delivered", "completed", "cancelled", "refunded"];

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Order ID</TableHead><TableHead>Total</TableHead>
            <TableHead>Cashback</TableHead><TableHead>Status</TableHead>
            <TableHead>Date</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.id.slice(0, 10)}…</TableCell>
                <TableCell className="font-bold">{formatCurrency(o.total)}</TableCell>
                <TableCell className="text-green-600">{formatCurrency(o.cashback)}</TableCell>
                <TableCell>
                  <Badge className={`${ORDER_STATUS_COLORS[o.status] ?? "bg-slate-100 text-slate-600"} border-none capitalize`}>{o.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">{fmtDate(o.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => { setSelected(o); setNewStatus(o.status); setReason(""); }}>
                    Update status
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No orders in this store.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update order status</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>New Status</Label>
              <select className="w-full h-9 rounded-md border bg-transparent px-3 text-sm"
                value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reason <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input placeholder="Admin note…" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button disabled={!newStatus || updateStatus.isPending}
              onClick={() => selected && newStatus && updateStatus.mutate({ id: selected.id, status: newStatus, reason })}>
              {updateStatus.isPending ? "Saving…" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Summary tab
// ---------------------------------------------------------------------------
function SummaryTab({ storeId }: { storeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: summaryQK(storeId),
    queryFn: () => apiFetch<StoreSummary>(`/api/admin/stores/${storeId}/summary`),
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Products", value: data.productCount },
          { label: "Orders", value: data.orderCount },
          { label: "Total Revenue", value: formatCurrency(data.totalRevenue) },
          { label: "Cashback Paid", value: formatCurrency(data.totalCashback) },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-extrabold mt-0.5">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {data.recentOrders.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Recent Orders</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Order ID</TableHead><TableHead>Total</TableHead>
                <TableHead>Status</TableHead><TableHead>Date</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id.slice(0, 10)}…</TableCell>
                    <TableCell className="font-bold">{formatCurrency(o.total)}</TableCell>
                    <TableCell>
                      <Badge className={`${ORDER_STATUS_COLORS[o.status] ?? "bg-slate-100 text-slate-600"} border-none capitalize`}>{o.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{fmtDate(o.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Promotions — Coupons sub-tab
// ---------------------------------------------------------------------------
function PromoCouponsTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: couponsQK(storeId),
    queryFn: () => apiFetch<CouponRow[]>(`/api/admin/stores/${storeId}/coupons`),
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    code: "", title: "", discountType: "percent" as "percent" | "fixed",
    discountValue: "10", minOrderValue: "0", maxUses: "0", startsAt: today, endsAt: "",
  });

  const create = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch(`/api/admin/stores/${storeId}/coupons`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: couponsQK(storeId) });
      setOpen(false);
      setForm({ code: "", title: "", discountType: "percent", discountValue: "10", minOrderValue: "0", maxUses: "0", startsAt: today, endsAt: "" });
    },
    onError: (e: Error) => setError(e.message || "Could not create coupon."),
  });

  function submit() {
    setError(null);
    if (!form.code.trim() || !form.title.trim() || !form.endsAt) {
      setError("Code, title and end date are required."); return;
    }
    create.mutate({
      code: form.code.trim().toUpperCase(), title: form.title.trim(),
      discountType: form.discountType, discountValue: Number(form.discountValue),
      minOrderValue: Number(form.minOrderValue) || 0, maxUses: Number(form.maxUses) || 0,
      startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(),
    });
  }

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => { setError(null); setOpen(true); }}>
          <Plus className="w-4 h-4" /> New coupon
        </Button>
      </div>
      {(data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No coupons for this store yet.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {(data ?? []).map((c) => (
            <Card key={c.id} className="border-border/60">
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <span className="font-mono font-bold text-primary">{c.code}</span>
                <span className="text-sm font-medium flex-1 min-w-32">{c.title}</span>
                <span className="text-sm text-muted-foreground">
                  {c.discountType === "percent" ? `${c.discountValue}% off` : `${formatCurrency(c.discountValue)} off`}
                  {c.minOrderValue > 0 && ` · min ${formatCurrency(c.minOrderValue)}`}
                  {c.maxUses > 0 && ` · ${c.usedCount}/${c.maxUses} used`}
                </span>
                {statusBadge(c.status)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New coupon</DialogTitle>
            <DialogDescription>Admin-created coupons are auto-approved.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Code</Label><Input value={form.code} placeholder="SAVE20" onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div className="space-y-1"><Label>Title</Label><Input value={form.title} placeholder="Summer sale" onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <div className="flex gap-1">
                  {(["percent", "fixed"] as const).map((t) => (
                    <button key={t} type="button"
                      className={`flex-1 rounded-md border px-2 py-1.5 text-sm transition-colors ${form.discountType === t ? "border-primary bg-primary/5 font-semibold" : "hover:bg-muted"}`}
                      onClick={() => setForm({ ...form, discountType: t })}>
                      {t === "percent" ? "% off" : "৳ off"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1"><Label>Value</Label><Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Min order (0 = none)</Label><Input type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} /></div>
              <div className="space-y-1"><Label>Max uses (0 = ∞)</Label><Input type="number" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Starts</Label><Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Ends</Label><Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create coupon"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Promotions — Deals sub-tab
// ---------------------------------------------------------------------------
function PromoDealsTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: dealsQK(storeId),
    queryFn: () => apiFetch<DealRow[]>(`/api/admin/stores/${storeId}/deals`),
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ title: "", description: "", discountPercent: "10", startsAt: today, endsAt: "" });

  const create = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch(`/api/admin/stores/${storeId}/deals`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dealsQK(storeId) });
      setOpen(false);
      setForm({ title: "", description: "", discountPercent: "10", startsAt: today, endsAt: "" });
    },
    onError: (e: Error) => setError(e.message || "Could not create deal."),
  });

  function submit() {
    setError(null);
    if (!form.title.trim() || !form.endsAt) { setError("Title and end date are required."); return; }
    create.mutate({
      title: form.title.trim(), description: form.description.trim(),
      discountPercent: Number(form.discountPercent),
      startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(),
    });
  }

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => { setError(null); setOpen(true); }}>
          <Plus className="w-4 h-4" /> New deal
        </Button>
      </div>
      {(data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No deals for this store yet.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {(data ?? []).map((d) => (
            <Card key={d.id} className="border-border/60">
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <span className="font-black text-red-600">-{Math.round(d.discountPercent)}%</span>
                <span className="text-sm font-medium flex-1 min-w-32">{d.title}</span>
                <span className="text-xs text-muted-foreground">
                  Ends {new Intl.DateTimeFormat("en-BD", { month: "short", day: "numeric" }).format(new Date(d.endsAt))}
                </span>
                {d.featured && <Badge className="bg-yellow-100 text-yellow-700 border-none">Featured</Badge>}
                {statusBadge(d.status)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New promotional deal</DialogTitle>
            <DialogDescription>Admin-created deals are auto-approved and go live immediately.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1"><Label>Title</Label><Input value={form.title} placeholder="Mid-season blowout" onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={form.description} placeholder="What's on offer?" onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Discount %</Label><Input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} /></div>
              <div className="space-y-1"><Label>Starts</Label><Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Ends</Label><Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create deal"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Promotions — Group Buys sub-tab
// ---------------------------------------------------------------------------
function PromoGroupBuysTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: groupBuysQK(storeId),
    queryFn: () => apiFetch<GroupBuyRow[]>(`/api/admin/stores/${storeId}/group-buys`),
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", category: "", image: "", originalPrice: "", groupPrice: "",
    cashbackPercent: "5", depositPercent: "20", minParticipants: "5", endsAt: "",
  });

  const create = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch(`/api/admin/stores/${storeId}/group-buys`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupBuysQK(storeId) });
      setOpen(false);
      setForm({ title: "", category: "", image: "", originalPrice: "", groupPrice: "", cashbackPercent: "5", depositPercent: "20", minParticipants: "5", endsAt: "" });
    },
    onError: (e: Error) => setError(e.message || "Could not create campaign."),
  });

  function submit() {
    setError(null);
    if (!form.title.trim() || !form.category.trim() || !form.endsAt || !form.originalPrice || !form.groupPrice) {
      setError("Title, category, prices and end date are required."); return;
    }
    create.mutate({
      title: form.title.trim(), category: form.category.trim(), image: form.image.trim() || undefined,
      originalPrice: Number(form.originalPrice), groupPrice: Number(form.groupPrice),
      cashbackPercent: Number(form.cashbackPercent), depositPercent: Number(form.depositPercent),
      minParticipants: Number(form.minParticipants), endsAt: new Date(form.endsAt).toISOString(),
    });
  }

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => { setError(null); setOpen(true); }}>
          <Plus className="w-4 h-4" /> New campaign
        </Button>
      </div>
      {(data ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No group buy campaigns for this store yet.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {(data ?? []).map((g) => (
            <Card key={g.id} className="border-border/60">
              <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium flex-1 min-w-32">{g.title}</span>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(g.groupPrice)} <s className="text-xs">{formatCurrency(g.originalPrice)}</s>
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {g.joinedCount}/{g.minParticipants}
                </span>
                {statusBadge(g.approvalStatus)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New group buy campaign</DialogTitle>
            <DialogDescription>Admin-created campaigns are auto-approved.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-1"><Label>Category</Label><Input value={form.category} placeholder="Electronics" onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Image URL <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Original price (৳)</Label><Input type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} /></div>
              <div className="space-y-1"><Label>Group price (৳)</Label><Input type="number" value={form.groupPrice} onChange={(e) => setForm({ ...form, groupPrice: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Cashback %</Label><Input type="number" value={form.cashbackPercent} onChange={(e) => setForm({ ...form, cashbackPercent: e.target.value })} /></div>
              <div className="space-y-1"><Label>Deposit %</Label><Input type="number" value={form.depositPercent} onChange={(e) => setForm({ ...form, depositPercent: e.target.value })} /></div>
              <div className="space-y-1"><Label>Min buyers</Label><Input type="number" value={form.minParticipants} onChange={(e) => setForm({ ...form, minParticipants: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Ends</Label><Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create campaign"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Promotions wrapper tab
// ---------------------------------------------------------------------------
function PromotionsTab({ storeId }: { storeId: string }) {
  return (
    <Tabs defaultValue="coupons">
      <TabsList>
        <TabsTrigger value="coupons" className="gap-1.5"><Ticket className="w-4 h-4" /> Coupons</TabsTrigger>
        <TabsTrigger value="deals" className="gap-1.5"><Flame className="w-4 h-4" /> Deals</TabsTrigger>
        <TabsTrigger value="group-buys" className="gap-1.5"><Users className="w-4 h-4" /> Group Buys</TabsTrigger>
      </TabsList>
      <TabsContent value="coupons" className="mt-4"><PromoCouponsTab storeId={storeId} /></TabsContent>
      <TabsContent value="deals" className="mt-4"><PromoDealsTab storeId={storeId} /></TabsContent>
      <TabsContent value="group-buys" className="mt-4"><PromoGroupBuysTab storeId={storeId} /></TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Main AdminStoreView
// ---------------------------------------------------------------------------
interface AdminStoreViewProps {
  storeId: string;
  storeName: string;
  onBack: () => void;
}

export default function AdminStoreView({ storeId, storeName, onBack }: AdminStoreViewProps) {
  return (
    <div className="space-y-4">
      {/* Admin impersonation banner */}
      <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2.5 text-sm">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>
          Managing <strong>{storeName}</strong> as Admin — all actions are logged and attributed to your account.
        </span>
      </div>

      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back to Merchants
        </Button>
        <h2 className="text-lg font-bold">{storeName}</h2>
      </div>

      {/* Sub-tabs */}
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary" className="gap-1.5"><BarChart2 className="w-4 h-4" /> Summary</TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5"><Package className="w-4 h-4" /> Products</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5"><ShoppingBag className="w-4 h-4" /> Orders</TabsTrigger>
          <TabsTrigger value="promotions" className="gap-1.5"><Megaphone className="w-4 h-4" /> Promotions</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4"><SummaryTab storeId={storeId} /></TabsContent>
        <TabsContent value="products" className="mt-4"><ProductsTab storeId={storeId} /></TabsContent>
        <TabsContent value="orders" className="mt-4"><OrdersTab storeId={storeId} /></TabsContent>
        <TabsContent value="promotions" className="mt-4"><PromotionsTab storeId={storeId} /></TabsContent>
      </Tabs>
    </div>
  );
}
