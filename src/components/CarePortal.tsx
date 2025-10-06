import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";
import CareShiftWorkspace from "./CareShiftWorkspace";
import CareResidentsWorkspace from "./CareResidentsWorkspace";
import CareLogsWorkspace from "./CareLogsWorkspace";
import CareProfileWorkspace from "./CareProfileWorkspace";
import SupervisorTeamWorkspace from "./SupervisorTeamWorkspace";
import SupervisorComplianceWorkspace from "./SupervisorComplianceWorkspace";

export default function CarePortal() {
  const [activeView, setActiveView] = useState("shift");
  const sessionInfo = useQuery(api.access.getSessionInfo);
  const currentShift = useQuery(api.care.getCurrentShift);
  const isClockInRequired = useQuery(api.care.isClockInRequired);
  const logActivity = useMutation(api.access.logSessionActivity);

  const isSupervisor = sessionInfo?.role === "supervisor";
  const isClockedIn = !!currentShift;
  const requireClockIn = isClockInRequired ?? true;

  const navigationItems = [
    { id: "shift", label: "Shift", icon: "⏰", description: "Clock in/out" },
    { id: "residents", label: "Residents", icon: "🏠", description: "Location-scoped list" },
    { id: "logs", label: "Logs", icon: "📝", description: "Create & view logs" },
    { id: "profile", label: "My Profile", icon: "👤", description: "Credentials & acknowledgments" },
  ];

  const supervisorItems = [
    { id: "team", label: "Team", icon: "👥", description: "Time exceptions" },
    { id: "compliance", label: "Compliance", icon: "📋", description: "ISPs author/publish" },
  ];

  const handleNavigation = (viewId: string) => {
    setActiveView(viewId);
    logActivity({
      activity: "navigate_care_portal",
      details: `view=${viewId}`,
    });
  };

  const renderContent = () => {
    switch (activeView) {
      case "shift":
        return <CareShiftWorkspace />;
      case "residents":
        return <CareResidentsWorkspace />;
      case "logs":
        return <CareLogsWorkspace />;
      case "profile":
        return <CareProfileWorkspace />;
      case "team":
        return isSupervisor ? <SupervisorTeamWorkspace /> : <div>Access denied</div>;
      case "compliance":
        return isSupervisor ? <SupervisorComplianceWorkspace /> : <div>Access denied</div>;
      default:
        return <CareShiftWorkspace />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-64 bg-white shadow-sm border-r flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900">Care Portal</h1>
          {sessionInfo?.user && (
            <div className="mt-2 text-sm text-gray-600">
              {sessionInfo.user.name}
              {sessionInfo.role && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {sessionInfo.role.charAt(0).toUpperCase() + sessionInfo.role.slice(1)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {/* Clock-in reminder if not clocked in and required */}
          {requireClockIn && !isClockedIn && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start">
                <span className="text-amber-600 mr-2">⚠️</span>
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Clock in to access features</p>
                  <p className="text-xs mt-1">You must clock in before accessing residents, logs, and other features.</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Navigation */}
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const isDisabled = requireClockIn && !isClockedIn && item.id !== "shift";
              return (
                <button
                  key={item.id}
                  onClick={() => !isDisabled && handleNavigation(item.id)}
                  disabled={isDisabled}
                  className={`w-full flex items-center px-3 py-3 text-left rounded-lg transition-colors ${
                    activeView === item.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : isDisabled
                      ? "text-gray-400 bg-gray-50 cursor-not-allowed opacity-60"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-lg mr-3" role="img" aria-label={item.label}>
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-gray-500 truncate">{item.description}</div>
                  </div>
                  {isDisabled && (
                    <span className="text-xs text-gray-400">🔒</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Supervisor Tools */}
          {isSupervisor && (
            <div className="pt-4 border-t">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Supervisor Tools
              </div>
              <div className="space-y-1">
                {supervisorItems.map((item) => {
                  const isDisabled = requireClockIn && !isClockedIn;
                  return (
                    <button
                      key={item.id}
                      onClick={() => !isDisabled && handleNavigation(item.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center px-3 py-3 text-left rounded-lg transition-colors ${
                        activeView === item.id
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : isDisabled
                          ? "text-gray-400 bg-gray-50 cursor-not-allowed opacity-60"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-lg mr-3" role="img" aria-label={item.label}>
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-gray-500 truncate">{item.description}</div>
                      </div>
                      {isDisabled && (
                        <span className="text-xs text-gray-400">🔒</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t">
          <SignOutButton />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
