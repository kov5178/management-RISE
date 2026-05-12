import { useGetMe } from "@workspace/api-client-react";

export function useAuth() {
  const { data: user, isLoading, refetch } = useGetMe();

  return {
    user: user ?? null,
    isLoading,
    isLoggedIn: !!user,
    refetch,
    role: user?.role ?? null,
    isSuperAdmin: user?.role === "super_admin",
    isAdmin: user?.role === "admin" || user?.role === "super_admin",
  };
}
