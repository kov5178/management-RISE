import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "draft":
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-200 border-transparent">임시저장</Badge>;
    case "submitted":
      return <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-transparent">제출완료</Badge>;
    case "reviewing":
      return <Badge variant="default" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-transparent">검토중</Badge>;
    case "revision_requested":
      return <Badge variant="default" className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-transparent">보완요청</Badge>;
    case "approved":
      return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 border-transparent">승인</Badge>;
    case "rejected":
      return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 border-transparent">반려</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
