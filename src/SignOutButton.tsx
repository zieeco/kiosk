"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const currentShift = useQuery(api.care.getCurrentShift);
  const clockOut = useMutation(api.care.clockOut);

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    if (currentShift) {
      const confirmed = window.confirm(
        "You are currently clocked in. Signing out will automatically clock you out. Do you want to continue?"
      );
      if (!confirmed) return;
      try {
        await clockOut({});
        toast.success("Clocked out successfully");
      } catch (error: any) {
        toast.error("Failed to clock out: " + (error.message || "Unknown error"));
        return;
      }
    }
    void signOut();
  };

  return (
    <button
      className="px-4 py-2 rounded bg-white text-secondary border border-gray-200 font-semibold hover:bg-gray-50 hover:text-secondary-hover transition-colors shadow-sm hover:shadow"
      onClick={handleSignOut}
    >
      Sign out
    </button>
  );
}
