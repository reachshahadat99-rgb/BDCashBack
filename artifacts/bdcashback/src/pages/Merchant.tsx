import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCreateMerchantProduct,
  useCreateMerchantStore,
  useDeleteMerchantProduct,
  useGetMerchantSummary,
  useListMarketplaceCategories,
  useListMerchantOrders,
  useListMerchantProducts,
  useUpdateMerchantProduct,
  type MerchantProduct,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleDollarSign,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Store,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/utils";

type ProductForm = {
  categoryId: string;
  name: string;
  description: string;
  brand: string;
  price: string;
  originalPrice: string;
  cashbackPercent: string;
  imageUrl: string;
  stock: string;
  available: boolean;
};

const blankProduct: ProductForm = {
  categoryId: "",
  name: "",
  description: "",
  brand: "",
  price: "",
  originalPrice: "",
  cashbackPercent: "5",
  imageUrl: "",
  stock: "0",
  available: true,
};

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("en-BD", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "published" || status === "delivered") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "processing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "archived" || status === "cancelled") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function SignedOutMerchant() {
  return (
    <div className="container mx-auto flex min-h-[72vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg rounded-3xl border-border/70 shadow-sm">
        <CardContent className="p-8 text-center md:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-primary">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Open your merchant store</h1>
          <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">
            Sign in to create a free store, publish products, manage stock, and track your sales.
          </p>
          <Link
            href="/sign-in"
            className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Sign in to continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function StoreOnboarding({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const createStore = useCreateMerchantStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Give your store a name to continue.");
      return;
    }
    createStore.mutate(
      { data: { name: name.trim(), description: description.trim(), logoUrl: logoUrl.trim() } },
      { onSuccess: onCreated, onError: (err) => setError(err.message || "Could not create store.") },
    );
  };

  return (
    <div className="container mx-auto flex min-h-[72vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <div className="bg-gradient-to-br from-primary to-teal-800 p-8 text-white md:p-10">
          <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/15">
            Free merchant onboarding
          </Badge>
          <h1 className="mt-5 max-w-xl text-3xl font-extrabold tracking-tight md:text-4xl">
            Turn your products into rewards customers love.
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-teal-50">
            Create your store for free. There is no listing fee—you only participate when you make a successful sale.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-5 p-6 md:p-8">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="store-name">Store name</label>
            <Input id="store-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Nila Home" maxLength={80} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="store-description">Store description <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Textarea id="store-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell customers what makes your store special." rows={4} maxLength={500} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="store-logo">Logo URL <span className="font-normal text-muted-foreground">(optional)</span></label>
            <div className="flex gap-3">
              <Input id="store-logo" type="url" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://..." />
              {logoUrl && <img src={logoUrl} alt="" className="h-10 w-10 rounded-lg border object-cover" />}
            </div>
          </div>
          <Button type="submit" className="h-11 w-full font-bold" disabled={createStore.isPending}>
            {createStore.isPending ? "Creating your store..." : "Create store"}
            {!createStore.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: MerchantProduct | null;
  onSaved: () => void;
}) {
  const { data: categories } = useListMarketplaceCategories();
  const createProduct = useCreateMerchantProduct();
  const updateProduct = useUpdateMerchantProduct();
  const [form, setForm] = useState<ProductForm>(blankProduct);
  const [error, setError] = useState("");

  const editing = Boolean(product);
  const pending = createProduct.isPending || updateProduct.isPending;

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

  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
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
    if (!payload.categoryId || !payload.name || !payload.brand || !payload.imageUrl) {
      setError("Category, product name, brand, and image URL are required.");
      return;
    }
    if (!Number.isFinite(payload.price) || !Number.isFinite(payload.originalPrice) || !Number.isFinite(payload.stock)) {
      setError("Enter valid price and stock values.");
      return;
    }
    const onSuccess = () => {
      onSaved();
      onOpenChange(false);
    };
    const onError = (err: Error) => setError(err.message || "Could not save product.");
    if (product) {
      updateProduct.mutate({ id: product.id, data: payload }, { onSuccess, onError });
    } else {
      createProduct.mutate({ data: payload }, { onSuccess, onError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add a new product"}</DialogTitle>
          <DialogDescription>
            Set your price, inventory, cashback offer, and the image customers will see.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold" htmlFor="product-name">Product name</label>
              <Input id="product-name" value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. Handwoven Cotton Saree" maxLength={120} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="product-brand">Brand</label>
              <Input id="product-brand" value={form.brand} onChange={(event) => setField("brand", event.target.value)} placeholder="Brand or maker" maxLength={80} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="product-category">Category</label>
              <select id="product-category" value={form.categoryId} onChange={(event) => setField("categoryId", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Select a category</option>
                {categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="product-price">Selling price (BDT)</label>
              <Input id="product-price" type="number" min="0.01" step="0.01" value={form.price} onChange={(event) => setField("price", event.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="product-original">Original price (BDT)</label>
              <Input id="product-original" type="number" min="0.01" step="0.01" value={form.originalPrice} onChange={(event) => setField("originalPrice", event.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="product-cashback">Cashback offer (%)</label>
              <Input id="product-cashback" type="number" min="0" max="100" step="0.5" value={form.cashbackPercent} onChange={(event) => setField("cashbackPercent", event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="product-stock">Available stock</label>
              <Input id="product-stock" type="number" min="0" step="1" value={form.stock} onChange={(event) => setField("stock", event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold" htmlFor="product-image">Product image URL</label>
              <div className="flex gap-3">
                <Input id="product-image" type="url" value={form.imageUrl} onChange={(event) => setField("imageUrl", event.target.value)} placeholder="https://..." />
                {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-10 w-10 rounded-lg border object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>}
              </div>
              <p className="text-xs text-muted-foreground">Use a public image URL for now; Cloudinary upload can be connected for production media storage.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold" htmlFor="product-description">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Textarea id="product-description" value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder="Describe materials, sizes, delivery details, or what makes it special." rows={3} maxLength={1000} />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3">
            <input type="checkbox" checked={form.available} onChange={(event) => setField("available", event.target.checked)} className="h-4 w-4 accent-primary" />
            <span>
              <span className="block text-sm font-semibold">Available for sale</span>
              <span className="block text-xs text-muted-foreground">Products with zero stock are automatically unavailable.</span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !categories?.length}>
              {pending ? "Saving..." : editing ? "Save changes" : "Publish product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Merchant() {
  const { isLoaded, isSignedIn } = useAuth();
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MerchantProduct | null>(null);
  const summary = useGetMerchantSummary({ query: { queryKey: ["merchant-summary"], enabled: isLoaded && Boolean(isSignedIn), retry: false } });
  const products = useListMerchantProducts({ query: { queryKey: ["merchant-products"], enabled: isLoaded && Boolean(isSignedIn), retry: false } });
  const orders = useListMerchantOrders({ query: { queryKey: ["merchant-orders"], enabled: isLoaded && Boolean(isSignedIn), retry: false } });
  const deleteProduct = useDeleteMerchantProduct();
  const isLoading = summary.isLoading || products.isLoading || orders.isLoading;

  if (isLoaded && !isSignedIn) return <SignedOutMerchant />;
  if (!isLoaded || isLoading) {
    return (
      <div className="container mx-auto space-y-6 px-4 py-8">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const hasStore = Boolean(summary.data?.store);
  if (!hasStore) {
    return <StoreOnboarding onCreated={() => { summary.refetch(); products.refetch(); orders.refetch(); }} />;
  }

  const data = summary.data;
  const productRows = products.data ?? [];
  const orderRows = orders.data ?? [];
  const refresh = () => {
    summary.refetch();
    products.refetch();
    orders.refetch();
  };
  const archive = (product: MerchantProduct) => {
    if (!window.confirm(`Archive ${product.name}? It will no longer be available for sale.`)) return;
    deleteProduct.mutate({ id: product.id }, { onSuccess: refresh });
  };

  return (
    <div className="container mx-auto space-y-8 px-4 py-6 md:py-10">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary"><LayoutDashboard className="h-4 w-4" /> Merchant workspace</div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{data?.store?.name}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{data?.store?.description || "Manage your products, inventory, and orders from one place."}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/merchant/promotions"><Button variant="outline"><Megaphone className="mr-2 h-4 w-4" /> Promotions</Button></Link>
          <Button variant="outline" onClick={refresh} disabled={isLoading}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          <Button onClick={() => { setEditingProduct(null); setShowProductDialog(true); }}><Plus className="mr-2 h-4 w-4" /> Add product</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Gross sales" value={formatCurrency(data?.grossSales ?? 0)} detail="Across all orders" icon={CircleDollarSign} tone="teal" />
        <MetricCard label="Products" value={formatNumber(data?.productCount ?? 0)} detail={`${data?.activeProductCount ?? 0} active listings`} icon={Package} tone="blue" />
        <MetricCard label="Orders" value={formatNumber(data?.orderCount ?? 0)} detail={`${data?.pendingOrders ?? 0} need attention`} icon={ShoppingBag} tone="amber" />
        <MetricCard label="Cashback issued" value={formatCurrency(data?.cashbackIssued ?? 0)} detail="Customer rewards generated" icon={Users} tone="violet" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden rounded-2xl border-border/70">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60">
            <div><CardTitle>Product catalog</CardTitle><p className="mt-1 text-sm text-muted-foreground">Manage pricing, inventory, and cashback settings.</p></div>
            <Badge variant="outline">{productRows.length} listings</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {productRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <Package className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <h3 className="font-bold">Your catalog is empty</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Publish your first product to start appearing in the BDCashBack marketplace.</p>
                <Button className="mt-5" onClick={() => setShowProductDialog(true)}><Plus className="mr-2 h-4 w-4" /> Add your first product</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr><th className="px-5 py-3 font-semibold">Product</th><th className="px-5 py-3 font-semibold">Price</th><th className="px-5 py-3 font-semibold">Cashback</th><th className="px-5 py-3 font-semibold">Stock</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3" /></tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {productRows.map((product) => (
                      <tr key={product.id} className="hover:bg-muted/20">
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-primary" />}</div><div><div className="font-semibold">{product.name}</div><div className="text-xs text-muted-foreground">{product.brand} · {product.categoryName}</div></div></div></td>
                        <td className="px-5 py-4 font-semibold">{formatCurrency(product.price)}</td>
                        <td className="px-5 py-4 font-semibold text-primary">{product.cashbackPercent}%</td>
                        <td className="px-5 py-4"><span className={product.stock === 0 ? "font-semibold text-red-600" : ""}>{product.stock}</span></td>
                        <td className="px-5 py-4"><Badge variant="outline" className={statusClass(product.status)}>{product.status === "published" && product.available ? "Live" : product.status === "archived" ? "Archived" : "Hidden"}</Badge></td>
                        <td className="px-5 py-4"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditingProduct(product); setShowProductDialog(true); }} aria-label={`Edit ${product.name}`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => archive(product)} aria-label={`Archive ${product.name}`}><Trash2 className="h-4 w-4" /></Button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Recent orders</CardTitle><p className="mt-1 text-sm text-muted-foreground">Keep fulfillment moving.</p></div><ShoppingBag className="h-5 w-5 text-primary" /></CardHeader>
          <CardContent className="space-y-3">
            {orderRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center"><ShoppingBag className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" /><p className="font-semibold">No orders yet</p><p className="mt-1 text-sm text-muted-foreground">Orders will appear here after customers buy your products.</p></div>
            ) : orderRows.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-3">
                <div className="min-w-0"><div className="truncate text-sm font-semibold">Order #{order.id.slice(-8)}</div><div className="mt-1 text-xs text-muted-foreground">{formatOrderDate(order.createdAt)} · {order.itemsCount} item{order.itemsCount === 1 ? "" : "s"}</div></div>
                <div className="text-right"><div className="font-bold">{formatCurrency(order.total)}</div><Badge variant="outline" className={`mt-1 text-[10px] ${statusClass(order.status)}`}>{order.status}</Badge></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <CardContent className="flex flex-col justify-between gap-5 p-6 md:flex-row md:items-center md:p-8">
          <div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300"><BarChart3 className="h-4 w-4" /> Merchant economics</div><h2 className="text-2xl font-extrabold">Free listings. Rewards that convert.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Your cashback offer is visible to customers before they buy. BDCashBack only earns after a successful sale, keeping your upfront cost at zero.</p></div>
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/10 p-5 text-center"><div className="text-3xl font-black text-amber-300">{data?.store?.status === "active" ? "Active" : "Review"}</div><div className="mt-1 text-xs font-medium text-slate-300">Store status</div></div>
        </CardContent>
      </Card>

      <ProductDialog open={showProductDialog} onOpenChange={setShowProductDialog} product={editingProduct} onSaved={refresh} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CircleDollarSign;
  tone: "teal" | "blue" | "amber" | "violet";
}) {
  const toneClass = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  }[tone];
  return <Card className="rounded-2xl border-border/70"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}><Icon className="h-5 w-5" /></div></div></CardContent></Card>;
}