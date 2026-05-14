import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const WARNING_SECONDS = 5 * 60;

interface IdleWarningModalProps {
  open: boolean;
  onContinue: () => void;
  onLogout: () => void;
}

export function IdleWarningModal({ open, onContinue, onLogout }: IdleWarningModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(WARNING_SECONDS);
      return;
    }

    setSecondsLeft(WARNING_SECONDS);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>세션이 곧 만료됩니다</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                장시간 활동이 없어 세션이 자동으로 종료될 예정입니다.
                계속 사용하시려면 아래 버튼을 클릭해 주세요.
              </p>
              <div className="flex items-center justify-center">
                <span className="text-3xl font-mono font-bold text-destructive tabular-nums">
                  {formatted}
                </span>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                남은 시간 내에 응답하지 않으면 자동으로 로그아웃됩니다.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onLogout}>로그아웃</AlertDialogCancel>
          <AlertDialogAction onClick={onContinue}>계속 사용</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
