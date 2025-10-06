import React, { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface AccessControlProps {
  children: React.ReactNode;
  route: string;
}

export default function AccessControl({ children, route }: AccessControlProps) {
  const [isChecking, setIsChecking] = useState(true);
  const accessCheck = useQuery(api.access.checkAccess, { route });
  const logActivity = useMutation(api.access.logSessionActivity);

  useEffect(() => {
    if (accessCheck !== undefined) {
      setIsChecking(false);
      
      if (!accessCheck.granted && accessCheck.redirectTo) {
        // Log the access denial
        logActivity({
          activity: "access_redirect",
          details: `from=${route},to=${accessCheck.redirectTo},reason=${accessCheck.reason}`,
        });
        
        // Redirect to appropriate page
        window.location.href = accessCheck.redirectTo;
      }
    }
  }, [accessCheck, route, logActivity]);

  if (isChecking || accessCheck === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!accessCheck.granted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.location.href = accessCheck.redirectTo || "/"}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
