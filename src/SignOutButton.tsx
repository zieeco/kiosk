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
      const confirmed = confirm(
        "You are currently clocked in. Would you like to clock out before signing out?\n\nClick OK to clock out and sign out.\nClick Cancel to sign out without clocking out."
      );
      if (confirmed) {
        try {
          await clockOut({});
          toast.success("Clocked out successfully");
        } catch (error: any) {
          console.error("Failed to clock out:", error);
          toast.error(error.message || "Failed to clock out");
          return;
        }
      }
    }
    await signOut();
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
