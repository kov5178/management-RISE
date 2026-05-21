import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Folder, CheckSquare, BarChart, Target, FileText,
  Files, MessageSquare, RefreshCw, Users, LogOut, LogIn, UserPlus,
  ClipboardList, ShieldCheck, History, ChevronRight, Clock, AlertTriangle, Settings2
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarProvider, SidebarFooter, SidebarMenuSub,
  SidebarMenuSubItem, SidebarMenuSubButton
} from "@/components/ui/sidebar";
import { ReactNode, useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLogout, useGetSettings } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQueryClient } from "@tanstack/react-query";
import { performIdleLogout } from "@/hooks/use-idle-timeout";

interface AdminLayoutProps {
  children: ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "최고관리자",
  admin: "사업단 관리자",
  project_manager: "프로젝트 관리자",
  task_manager: "단위과제 담당자",
  reviewer: "검토자",
  viewer: "조회자",
};

const NAV_ITEMS = [
  { title: "대시보드", href: "/", icon: LayoutDashboard },
  { title: "프로젝트 관리", href: "/projects", icon: Folder },
  { title: "단위과제 관리", href: "/tasks", icon: CheckSquare },
  { title: "지표 관리", href: "/indicators", icon: BarChart },
  { title: "목표값 관리", href: "/targets", icon: Target },
  { title: "실적 입력", href: "/results", icon: FileText },
  { title: "증빙관리", href: "/evidence", icon: Files },
  { title: "검토 관리", href: "/reviews", icon: MessageSquare },
  { title: "자체평가·환류", href: "/feedback", icon: RefreshCw },
];

const USER_MGMT_ITEMS = [
  { title: "사용자 목록 · 권한 변경", href: "/users", icon: Users },
  { title: "등록 요청 승인", href: "/user-requests", icon: ClipboardList },
  { title: "권한 변경 이력", href: "/role-change-logs", icon: History },
  { title: "시스템 설정", href: "/settings", icon: Settings2 },
];

function useSessionCountdown(
  lastLoginAt: string | null | undefined,
  sessionDurationMs: number,
) {
  const [remaining, setRemaining] = useState<number>(sessionDurationMs);

  useEffect(() => {
    setRemaining(sessionDurationMs);
  }, [sessionDurationMs]);

  useEffect(() => {
    if (!lastLoginAt) return;
    const tick = () => {
      const elapsed = Date.now() - new Date(lastLoginAt).getTime();
      setRemaining(Math.max(0, sessionDurationMs - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastLoginAt, sessionDurationMs]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const isWarning = remaining > 0 && remaining < 5 * 60 * 1000;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return { display, isWarning, remaining };
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, isLoggedIn, isAdmin, refetch } = useAuth();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { data: settingsData } = useGetSettings();
  const sessionDurationMs = (settingsData?.sessionTimeoutMinutes ?? 30) * 60 * 1000;
  const [userMgmtOpen, setUserMgmtOpen] = useState(
    location.startsWith("/users") || location.startsWith("/user-requests") || location.startsWith("/role-change-logs") || location.startsWith("/settings")
  );
  const { display: sessionDisplay, isWarning, remaining } = useSessionCountdown(
    isLoggedIn && user ? user.lastLoginAt : null,
    sessionDurationMs,
  );

  const [expiryCountdown, setExpiryCountdown] = useState<number | null>(null);
  const expiryHandledRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !user) {
      expiryHandledRef.current = false;
      setExpiryCountdown(null);
      return;
    }
    if (remaining === 0 && !expiryHandledRef.current) {
      expiryHandledRef.current = true;
      setExpiryCountdown(5);
    }
  }, [remaining, isLoggedIn, user]);

  useEffect(() => {
    if (expiryCountdown === null) return;
    if (expiryCountdown === 0) {
      performIdleLogout(navigate, "timeout").then(() => {
        queryClient.clear();
        refetch();
      });
      return;
    }
    const id = setTimeout(() => setExpiryCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [expiryCountdown, navigate, queryClient, refetch]);

  const handleLogout = async () => {
    await logout.mutateAsync();
    queryClient.clear();
    await refetch();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-sidebar-border">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2 px-2">
              <div className="bg-primary text-primary-foreground p-1 rounded">
                <BarChart className="w-5 h-5" />
              </div>
              <h1 className="text-sidebar-foreground font-bold tracking-tight text-lg">RISE 성과관리</h1>
            </div>
            <div className="px-2 mt-1">
              <span className="text-xs text-sidebar-foreground/70 font-medium">국립한국교통대학교</span>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarMenu className="px-2">
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.href} className="flex items-center gap-3 w-full">
                        <item.icon className="w-4 h-4" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {isAdmin && (
                <SidebarMenuItem>
                  <Collapsible open={userMgmtOpen} onOpenChange={setUserMgmtOpen}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={USER_MGMT_ITEMS.some(i => location.startsWith(i.href))}
                        className="flex items-center gap-3 w-full"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span className="font-medium flex-1">사용자 관리</span>
                        <ChevronRight className={`w-3 h-3 transition-transform ${userMgmtOpen ? "rotate-90" : ""}`} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {USER_MGMT_ITEMS.map((item) => {
                          const isActive = location === item.href || location.startsWith(item.href);
                          return (
                            <SidebarMenuSubItem key={item.href}>
                              <SidebarMenuSubButton asChild isActive={isActive}>
                                <Link href={item.href} className="flex items-center gap-2 w-full">
                                  <item.icon className="w-3 h-3" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-sidebar-border/50">
            {isLoggedIn && user ? (
              <div className="space-y-2">
                {expiryCountdown !== null ? (
                  <div className="flex items-center gap-1.5 px-2 py-2 rounded-md bg-destructive/20 text-destructive animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-semibold">
                      {expiryCountdown}초 후 자동 로그아웃됩니다
                    </span>
                  </div>
                ) : (
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${isWarning ? "bg-red-500/15 text-red-400" : "bg-sidebar-accent/40 text-sidebar-foreground/60"}`}>
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="text-xs font-mono font-semibold tracking-widest">{sessionDisplay}</span>
                    <span className="text-xs ml-0.5">남음</span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                    <p className="text-xs text-sidebar-foreground/60 truncate">{ROLE_LABELS[user.role] ?? user.role}</p>
                  </div>
                  <Badge className="text-xs bg-primary/10 text-primary border-transparent shrink-0">
                    {user.employeeNo}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  <span>로그아웃</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
                    <LogIn className="w-4 h-4" />
                    <span>로그인</span>
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
                    <UserPlus className="w-4 h-4" />
                    <span>사용자 등록 요청</span>
                  </Button>
                </Link>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
