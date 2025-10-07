"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm({ onSuccess }: { onSuccess?: (userId: string) => void }) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        {/* Logo Section */}
        <div className="flex justify-center mb-4">
          <img 
            src="/logo.png" 
            alt="El-Elyon Properties LLC Logo" 
            className="h-16 w-auto"
            onError={(e) => {
              // Fallback to text if logo image doesn't exist
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="text-3xl font-bold hidden">
            <span className="text-black">El-Elyon</span>
            <span className="text-blue-600"> Properties LLC</span>
          </div>
        </div>

        <form
          className="flex flex-col gap-4 sm:gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitting(true);
            const formData = new FormData(e.target as HTMLFormElement);
            formData.set("flow", flow);
            void signIn("password", formData)
              .then((result) => {
                if (onSuccess && result) onSuccess(result.toString());
              })
              .catch((error) => {
                let toastTitle = "";
                if (error.message.includes("Invalid password")) {
                  toastTitle = "Invalid password. Please try again.";
                } else {
                  toastTitle =
                    flow === "signIn"
                      ? "Could not sign in, did you mean to sign up?"
                      : "Could not sign up, did you mean to sign in?";
                }
                toast.error(toastTitle);
                setSubmitting(false);
              });
          }}
        >
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-center">
            {flow === "signIn" ? "Welcome back" : "Create your account"}
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
              autoComplete="email"
              required
            />
            <input
              className="
                auth-input-field w-full
                rounded-lg border border-gray-300 dark:border-neutral-700
                bg-white dark:bg-neutral-900
                px-3.5 py-2.5 pr-10
                placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
              "
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              autoComplete={flow === "signIn" ? "current-password" : "new-password"}
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
            {submitting
              ? flow === "signIn" ? "Signing in…" : "Creating account…"
              : flow === "signIn" ? "Sign in" : "Sign up"}
          </button>

          <div className="text-center text-sm text-secondary sm:text-base">
            <span>
              {flow === "signIn" ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              type="button"
              className="text-primary hover:text-primary/80 hover:underline font-medium"
              onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
            >
              {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
            </button>
          </div>
{/* 
          <div className="flex items-center gap-3 my-2">
            <hr className="grow border-gray-200 dark:border-neutral-800" />
            <span className="text-secondary text-sm">or</span>
            <hr className="grow border-gray-200 dark:border-neutral-800" />
          </div> */}

          {/* <button
            className="
              auth-button
              w-full block
              rounded-lg px-4 py-2.5
              font-medium
            "
            type="button"
            onClick={() => void signIn("anonymous")}
            disabled={submitting}
          >
            Continue as guest
          </button> */}
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            powered by <span className="font-semibold text-gray-700">Bold Ideas Innovations Ltd</span>
          </p>
        </div>
      </div>
    </div>
  );
}
