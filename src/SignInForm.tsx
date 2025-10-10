"use client";
import { SignIn } from "@clerk/clerk-react";

export function SignInForm() {
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

        <SignIn routing="hash" signUpUrl="/sign-up" />

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
