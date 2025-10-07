import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";

export default function PendingPage() {
  const sessionInfo = useQuery(api.access.getSessionInfo);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <div className="text-6xl mb-6">⏳</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Account Pending Setup</h2>
        <p className="text-gray-600 mb-6">
          Your account is being configured by an administrator. Please check back later or contact your system administrator for assistance.
        </p>
        
        {sessionInfo?.user && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>Account:</strong> {sessionInfo.user.name}
            </p>
            {sessionInfo.user.email && (
              <p className="text-sm text-gray-700">
                <strong>Email:</strong> {sessionInfo.user.email}
              </p>
            )}
          </div>
        )}
        
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Check Again
          </button>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}