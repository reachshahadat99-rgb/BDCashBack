import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListAdminAuditLogs } from "@workspace/api-client-react";
import { fmtDate } from "@/lib/utils";

export default function AuditLogsTab() {
  const { data, isLoading } = useListAdminAuditLogs({ limit: 100 });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const actionColor = (action: string) => {
    if (action.includes("reject") || action.includes("cancel")) return "bg-red-100 text-red-700";
    if (action.includes("approve") || action.includes("complete")) return "bg-green-100 text-green-700";
    return "bg-blue-100 text-blue-700";
  };

  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Admin</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead>
          <TableHead>Details</TableHead><TableHead>Date</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(data ?? []).map((log) => (
            <TableRow key={log.id}>
              <TableCell className="font-mono text-xs">{log.adminUserId.slice(0, 12)}…</TableCell>
              <TableCell>
                <Badge className={`${actionColor(log.action)} border-none text-xs`}>{log.action}</Badge>
              </TableCell>
              <TableCell className="text-xs">
                <span className="text-muted-foreground">{log.targetType}/</span>
                <span className="font-mono">{log.targetId.slice(0, 8)}…</span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{log.details}</TableCell>
              <TableCell className="text-xs">{fmtDate(log.createdAt)}</TableCell>
            </TableRow>
          ))}
          {(data ?? []).length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No audit log entries yet.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
