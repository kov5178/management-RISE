import { useGetMe } from "@workspace/api-client-react";

export function useAuth() {
  const { data: user, isLoading, refetch } = useGetMe();

  const role = user?.role ?? null;

  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin" || role === "super_admin";

  const canManageProjects =
    role === "super_admin" || role === "admin" || role === "project_manager";

  const canManageTargets =
    role === "super_admin" ||
    role === "admin" ||
    role === "project_manager" ||
    role === "task_manager";

  const canInputResults =
    role === "super_admin" ||
    role === "admin" ||
    role === "project_manager" ||
    role === "task_manager";

  const canManageEvidence =
    role === "super_admin" ||
    role === "admin" ||
    role === "project_manager" ||
    role === "task_manager";

  const canReview =
    role === "super_admin" || role === "admin" || role === "reviewer";

  const canWriteFeedback =
    role === "super_admin" ||
    role === "admin" ||
    role === "project_manager" ||
    role === "task_manager";

  return {
    user: user ?? null,
    isLoading,
    isLoggedIn: !!user,
    refetch,
    role,
    isSuperAdmin,
    isAdmin,
    canManageProjects,
    canManageTargets,
    canInputResults,
    canManageEvidence,
    canReview,
    canWriteFeedback,
    mustChangePassword: user?.mustChangePassword ?? false,
  };
}
