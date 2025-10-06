import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";
import Sidebar from "./Sidebar";
import AdminDashboard from "./AdminDashboard";
import PeopleWorkspace from "./PeopleWorkspace";
import ComplianceWorkspace from "./ComplianceWorkspace";
import SettingsWorkspace from "./SettingsWorkspace";
import ComplianceAlerts from "./ComplianceAlerts";
import LocationsWorkspace from "./LocationsWorkspace";
import GuardianChecklistWorkspace from "./GuardianChecklistWorkspace";

export default function AdminPortal() {
  const [activeView, setActiveView] = useState("dashboard");
  const user = useQuery(api.auth.loggedInUser);

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <AdminDashboard onNavigate={setActiveView} />;
      case "people":
        return <PeopleWorkspace />;
      case "compliance":
        return <ComplianceWorkspace />;
      case "locations":
        return <LocationsWorkspace />;
      case "guardian-checklists":
        return <GuardianChecklistWorkspace />;
      case "settings":
        return <SettingsWorkspace />;
      default:
        return <AdminDashboard onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        selected={activeView}
        setSelected={setActiveView}
      />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {activeView.charAt(0).toUpperCase() + activeView.slice(1)}
          </h1>
          <SignOutButton />
        </div>
        <ComplianceAlerts />
        {renderContent()}
      </main>
    </div>
  );
}
