import { Link, useLocation } from "wouter";
import { LayoutDashboard, Folder, CheckSquare, BarChart, Target, FileText, Files, MessageSquare, RefreshCw, Users, LogOut } from "lucide-react";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarFooter } from "@/components/ui/sidebar";
import { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

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
  { title: "사용자 관리", href: "/users", icon: Users },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();

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
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href} className="flex items-center gap-3 w-full">
                        <item.icon className="w-4 h-4" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border/50">
             <SidebarMenu>
               <SidebarMenuItem>
                 <SidebarMenuButton asChild>
                   <button className="flex items-center gap-3 w-full text-sidebar-foreground/70 hover:text-sidebar-foreground">
                     <LogOut className="w-4 h-4" />
                     <span>로그아웃</span>
                   </button>
                 </SidebarMenuButton>
               </SidebarMenuItem>
             </SidebarMenu>
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
