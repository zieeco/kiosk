import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { Toaster } from "sonner";
import KioskSession from "./KioskSession";
import InviteAcceptance from "./components/InviteAcceptance";
import GuardianChecklistPublic from "./components/GuardianChecklistPublic";
import AccessControl from "./components/AccessControl";
import AdminPortal from "./components/AdminPortal";
import CarePortal from "./components/CarePortal";
import PendingPage from "./components/PendingPage";
import FirstAdminSetup from "./components/FirstAdminSetup";
import { useEffect, useState } from "react";

function App() {
  // Check if this is an invite acceptance URL or checklist URL
  const urlParams = new URLSearchParams(window.location.search);
  const inviteToken = urlParams.get("invite");
  const checklistToken = urlParams.get("checklist");

  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);
  const sessionInfo = useQuery(api.access.getSessionInfo);
  const role = useQuery(api.settings.getUserRole);
  const userEmployeeLink = useQuery(api.employees.checkUserEmployeeLink);
  const hasAdmin = useQuery(api.admin.hasAdminUser);

  // Show Guardian Checklist page if checklistToken is present
  if (checklistToken) {
    return (
      <>
        <Toaster />
        <GuardianChecklistPublic token={checklistToken} />
      </>
    );
  }

  // Show InviteAcceptance page first if inviteToken is present
  if (inviteToken) {
    return (
      <>
        <Toaster />
        <InviteAcceptance token={inviteToken} />
      </>
    );
  }

  // Show Kiosk mode if on /kiosk route
  if (currentRoute === "/kiosk") {
    return (
      <>
        <Toaster />
        <Authenticated>
          <KioskSession>{null}</KioskSession>
        </Authenticated>
        <Unauthenticated>
          <SignInForm />
        </Unauthenticated>
      </>
    );
  }

  // Update route when URL changes
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Handle automatic routing based on user role
  useEffect(() => {
    if (sessionInfo && sessionInfo.authenticated) {
      const { defaultRoute } = sessionInfo;
      // Only redirect if we're on root path
      if (currentRoute === "/") {
        if (currentRoute !== defaultRoute) {
          window.history.replaceState({}, "", defaultRoute);
          setCurrentRoute(defaultRoute);
        }
      }
    }
  }, [sessionInfo, currentRoute]);

  const renderAuthenticatedContent = () => {
    // Show first admin setup if no admin exists
    if (hasAdmin === false) {
      return <FirstAdminSetup />;
    }

    // Handle kiosk mode
    if (role?.isKiosk) {
      return <KioskSession>{null}</KioskSession>;
    }

    // If user does NOT have a role but has a pending employee link, show InviteAcceptance
    if (!sessionInfo?.role && userEmployeeLink) {
      return <InviteAcceptance token="" />;
    }

    // If user does NOT have a role and no pending link, show PendingPage
    if (currentRoute === "/pending" || !sessionInfo?.role) {
      return <PendingPage />;
    }

    // Admin portal - only for admin role
    if (currentRoute.startsWith("/admin")) {
      return (
        <AccessControl route={currentRoute}>
          <AdminPortal />
        </AccessControl>
      );
    }

    // Care portal - for supervisor and staff roles
    if (currentRoute.startsWith("/care")) {
      return (
        <AccessControl route={currentRoute}>
          <CarePortal />
        </AccessControl>
      );
    }

    // Default routing based on role
    if (sessionInfo?.role === "admin") {
      return (
        <AccessControl route="/admin">
          <AdminPortal />
        </AccessControl>
      );
    }

    if (sessionInfo?.role === "supervisor" || sessionInfo?.role === "staff") {
      return (
        <AccessControl route="/care">
          <CarePortal />
        </AccessControl>
      );
    }

    // Default fallback
    return <PendingPage />;
  };

  return (
    <>
      <Toaster />
      <Authenticated>{renderAuthenticatedContent()}</Authenticated>
      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>
    </>
  );
}

export default App;
