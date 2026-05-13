import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Folder, CheckSquare, BarChart, Target, FileText,
  Files, MessageSquare, RefreshCw, Users, LogOut, LogIn, UserPlus,
  ClipboardList, ShieldCheck, History, ChevronRight
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarProvider, SidebarFooter, SidebarMenuSub,
  SidebarMenuSubItem, SidebarMenuSubButton
} from "@/components/ui/sidebar";
import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQueryClient } from "@tanstack/react-query";

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
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, isLoggedIn, isAdmin, refetch } = useAuth();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [userMgmtOpen, setUserMgmtOpen] = useState(
    location.startsWith("/users") || location.startsWith("/user-requests") || location.startsWith("/role-change-logs")
  );

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

              {/* 사용자 관리 collapsible — admin/super_admin 전용 */}
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
