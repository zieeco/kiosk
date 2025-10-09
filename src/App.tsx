import { useQuery } from "convex/react";
import { SignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "../convex/_generated/api";
import { Toaster } from "sonner";
import KioskSession from "./KioskSession";
import GuardianChecklistPublic from "./components/GuardianChecklistPublic";
import AccessControl from "./components/AccessControl";
import AdminPortal from "./components/AdminPortal";
import CarePortal from "./components/CarePortal";
import PendingPage from "./components/PendingPage";
import { useEffect, useState } from "react";
import {useUser} from '@clerk/clerk-react';
import { getDeviceId } from './lib/device'; // Import getDeviceId

function App() {
  // Check if this is a checklist URL
  const urlParams = new URLSearchParams(window.location.search);
  const checklistToken = urlParams.get("checklist");

  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);

  // Show Guardian Checklist page if checklistToken is present
  if (checklistToken) {
    return (
      <>
        <Toaster />
        <GuardianChecklistPublic token={checklistToken} />
      </>
    );
  }

  // Show Kiosk mode if on /kiosk route
  if (currentRoute === "/kiosk") {
    return (
      <>
        <Toaster />
        <SignedIn>
          <KioskSession>{null}</KioskSession>
        </SignedIn>
        <SignedOut>
          <div className="flex items-center justify-center min-h-screen">
            <SignIn routing="hash" />
          </div>
        </SignedOut>
      </>
    );
  }

  // Update route when URL changes
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <>
      <Toaster />
      <SignedIn>
        <AuthenticatedApp currentRoute={currentRoute} setCurrentRoute={setCurrentRoute} />
      </SignedIn>
      <SignedOut>
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <SignIn routing="hash" signUpUrl="/sign-up" />
        </div>
      </SignedOut>
    </>
  );
}

function AuthenticatedApp({
  currentRoute,
  setCurrentRoute
}: { 
  currentRoute: string;
  setCurrentRoute: (route: string) => void;
}) {
	const {user} = useUser();
	const deviceId = getDeviceId(); // Get device ID

	// TEMPORARY: Show your Clerk User ID
	if (user?.id) {
		console.log('🔑 Your Clerk User ID:', user.id);
		console.log('📧 Your Email:', user.primaryEmailAddress?.emailAddress);
		console.log('💻 Device ID:', deviceId);
	}

	const sessionInfo = useQuery(api.access.getSessionInfo);
	const role = useQuery(api.settings.getUserRole);
	const deviceAuthorization = useQuery(
		user?.id ? api.employees.checkDeviceAuthorization : undefined,
		user?.id ? { clerkUserId: user.id, deviceId } : undefined
	);

	// Handle automatic routing based on user role
	useEffect(() => {
		if (sessionInfo && sessionInfo.authenticated) {
			const {defaultRoute} = sessionInfo;
			// Only redirect if we're on root path
			if (currentRoute === '/') {
				if (currentRoute !== defaultRoute) {
					window.history.replaceState({}, '', defaultRoute);
					setCurrentRoute(defaultRoute);
				}
			}
		}
	}, [sessionInfo, currentRoute, setCurrentRoute]);

	// Loading state
	if (sessionInfo === undefined || role === undefined || deviceAuthorization === undefined) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="text-4xl mb-4">⏳</div>
					<p className="text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	// Device authorization check
	if (!deviceAuthorization?.isAuthorized) {
		console.warn("Unauthorized device access:", deviceAuthorization?.reason);
		return <PendingPage message="Unauthorized device. Please log in from an assigned company kiosk." />;
	}

	// Handle kiosk mode
	if (role?.isKiosk) {
		return <KioskSession>{null}</KioskSession>;
	}

	// If user does NOT have a role, show PendingPage
	if (currentRoute === '/pending' || !sessionInfo?.role) {
		return <PendingPage />;
	}

	// Admin portal - only for admin role
	if (currentRoute.startsWith('/admin')) {
		return (
			<AccessControl route={currentRoute}>
				<AdminPortal />
			</AccessControl>
		);
	}

	// Care portal - for supervisor and staff roles
	if (currentRoute.startsWith('/care')) {
		return (
			<AccessControl route={currentRoute}>
				<CarePortal />
			</AccessControl>
		);
	}

	// Default routing based on role
	if (sessionInfo?.role === 'admin') {
		return (
			<AccessControl route="/admin">
				<AdminPortal />
			</AccessControl>
		);
	}

	if (sessionInfo?.role === 'supervisor' || sessionInfo?.role === 'staff') {
		return (
			<AccessControl route="/care">
				<CarePortal />
			</AccessControl>
		);
	}

	// Default fallback
	return <PendingPage />;
}

export default App;
