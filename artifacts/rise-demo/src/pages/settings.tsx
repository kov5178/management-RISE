import { useState } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Clock, Save } from "lucide-react";

const TIMEOUT_OPTIONS = [
  { value: 15, label: "15분" },
  { value: 30, label: "30분 (기본값)" },
  { value: 60, label: "60분" },
  { value: 120, label: "120분" },
];

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedTimeout, setSelectedTimeout] = useState<number | null>(null);

  const currentTimeout = selectedTimeout ?? settings?.sessionTimeoutMinutes ?? 30;

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({ data: { sessionTimeoutMinutes: currentTimeout } });
      await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({
        title: "설정이 저장되었습니다",
        description: `세션 타임아웃이 ${currentTimeout}분으로 변경되었습니다.`,
      });
    } catch {
      toast({
        title: "저장에 실패했습니다",
        description: "설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="w-6 h-6" />
          시스템 설정
        </h1>
        <p className="text-muted-foreground mt-1">
          RISE 성과관리 시스템의 보안 및 운영 설정을 관리합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4" />
            세션 타임아웃 설정
          </CardTitle>
          <CardDescription>
            일정 시간 동안 활동이 없으면 자동으로 로그아웃됩니다. 변경 사항은 모든 사용자에게 즉시 적용됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="timeout-select">타임아웃 시간</Label>
              <Select
                value={String(currentTimeout)}
                onValueChange={(v) => setSelectedTimeout(Number(v))}
              >
                <SelectTrigger id="timeout-select" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEOUT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                현재 설정: {settings?.sessionTimeoutMinutes ?? 30}분 /
                경고는 타임아웃 5분 전에 표시됩니다.
              </p>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending || isLoading}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {updateSettings.isPending ? "저장 중..." : "저장"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
