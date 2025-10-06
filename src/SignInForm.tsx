"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm({ onSuccess }: { onSuccess?: (userId: string) => void }) {
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = useState(false);

  return (
    <div
      className="
        w-full min-h-screen
        bg-[rgb(248_250_252)] dark:bg-neutral-950
        px-4 py-10 flex items-center justify-center
      "
    >
      {/* Centered, reduced-width container */}
      <div
        className="
          mx-auto w-full
          max-w-[440px] sm:max-w-[480px] md:max-w-[520px] lg:max-w-[560px]
          bg-white/95 dark:bg-neutral-900/95
          border border-gray-200 dark:border-neutral-800
          rounded-2xl shadow-lg
          p-6 sm:p-7 md:p-8
        "
      >
        {/* Wordmark (no logo) */}
        <div className="mb-2 text-center">
          <div className="text-3xl font-bold tracking-tight text-black">
            El-Elyon <span className="text-blue-500">Properties LLC</span>
          </div>
        </div>

        <form
          className="flex flex-col gap-4 sm:gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitting(true);
            const formData = new FormData(e.target as HTMLFormElement);
            // Internal app: sign-in only
            formData.set("flow", "signIn");
            void signIn("password", formData)
              .then((result) => {
                if (onSuccess && result) onSuccess(result.toString());
              })
              .catch((error) => {
                const errorMessage = error.message || "An unknown error occurred";
                console.error("Sign-in error:", errorMessage);
                if (errorMessage.includes("Invalid password")) {
                  toast.error("Invalid password. Please try again.");
                } else if (errorMessage.includes("User not found")) {
                  toast.error("No account found with that email address.");
                } else {
                  toast.error(`Could not sign in: ${errorMessage}`);
                }
                setSubmitting(false);
              });
          }}
        >
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-center">
            Welcome back
          </h1>

          <div className="flex flex-col gap-3">
            <input
              className="
                auth-input-field w-full
                rounded-lg border border-gray-300 dark:border-neutral-700
                bg-white dark:bg-neutral-900
                px-3.5 py-2.5
                placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
              "
              type="email"
              name="email"
              placeholder="Email"
              autoComplete="username"
              required
            />
            <input
              className="
                auth-input-field w-full
                rounded-lg border border-gray-300 dark:border-neutral-700
                bg-white dark:bg-neutral-900
                px-3.5 py-2.5
                placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
              "
              type="password"
              name="password"
              placeholder="Password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            className="
              auth-button
              w-full
              inline-flex items-center justify-center
              rounded-lg px-4 py-2.5
              font-medium
              disabled:opacity-60 disabled:cursor-not-allowed
            "
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in securely"}
          </button>

          {/* Optional internal link — keep if you support password resets */}
          <div className="text-right">
            <a href="/forgot" className="text-sm text-primary hover:text-primary/80 underline">
              Forgot password?
            </a>
          </div>

          {/* Removed public sign-up toggle for internal app */}
        </form>

        {/* Footer credit */}
        <div className="pt-6 text-center text-xs text-gray-500">
          Powered by <span className="font-medium">Bold Ideas Innovations Ltd.</span>
        </div>
      </div>
    </div>
  );
}
