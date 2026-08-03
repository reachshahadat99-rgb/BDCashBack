/**
 * Shared helpers used by all admin tab components.
 */
import { Badge } from "@/components/ui/badge";

export function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    active: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    rejected: "bg-red-100 text-red-700",
    suspended: "bg-red-100 text-red-700",
    archived: "bg-slate-100 text-slate-600",
  };
  return (
    <Badge className={`${map[status] ?? "bg-slate-100 text-slate-600"} border-none capitalize`}>
      {status}
    </Badge>
  );
}
