import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import KioskSession from "./KioskSession";
import ComplianceAlerts from "./components/ComplianceAlerts";
import ComplianceWorkspace from "./components/ComplianceWorkspace";
import PeopleWorkspace from "./components/PeopleWorkspace";
import SettingsWorkspace from "./components/SettingsWorkspace";
import AdminDashboard from "./components/AdminDashboard";
import InviteAcceptance from "./components/InviteAcceptance";
import { useState } from "react";
import Sidebar from "./components/Sidebar";

function App() {
  // Check if this is an invite acceptance URL
  const urlParams = new URLSearchParams(window.location.search);
  const inviteToken = urlParams.get('invite');

  const [activeView, setActiveView] = useState("dashboard");
  const user = useQuery(api.auth.loggedInUser);
  const role = useQuery(api.settings.getUserRole);

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <AdminDashboard />;
      case "people":
        return <PeopleWorkspace />;
      case "compliance":
        return <ComplianceWorkspace />;
      case "settings":
        return <SettingsWorkspace />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <>
      <Toaster />
      <Authenticated>
        {inviteToken ? (
          <InviteAcceptance token={inviteToken} />
        ) : (
          <>
            {role?.isKiosk ? (
              <KioskSession>{null}</KioskSession>
            ) : (
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
            )}
          </>
        )}
      </Authenticated>
      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>
    </>
  );
}

export default App;
