// src/App.tsx
import {useQuery} from 'convex/react';
import {SignIn, SignedIn, SignedOut} from '@clerk/clerk-react';
import {useUser} from '@clerk/clerk-react';
import {api} from '../convex/_generated/api';
import {Toaster} from 'sonner';
import KioskSession from './KioskSession';
import GuardianChecklistPublic from './components/GuardianChecklistPublic';
import AccessControl from './components/AccessControl';
import AdminPortal from './components/AdminPortal';
import CarePortal from './components/CarePortal';
import PendingPage from './components/PendingPage';
import {useEffect, useState} from 'react';
// ✅ Import the NEW async device ID function
import {getOrCreateDeviceId} from './lib/device';

// ✅ Global device ID (safe: never changes after init)
let globalDeviceId: string | null = null;

function App() {
	const urlParams = new URLSearchParams(window.location.search);
	const checklistToken = urlParams.get('checklist');
	const [currentRoute, setCurrentRoute] = useState(window.location.pathname);

	// ✅ Initialize device ID once at app startup
	useEffect(() => {
		if (globalDeviceId === null) {
			getOrCreateDeviceId()
				.then((id) => {
					globalDeviceId = id;
					console.log('Intialized device ID:', id);
				})
				.catch((err) => {
					console.error('Failed to initialize device ID:', err);
					// Fallback: generate temporary ID (won't pass validation, but avoids crash)
					globalDeviceId = `temp_${Math.random().toString(36).slice(2, 10)}`;
				});
		}
	}, []);

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
	if (currentRoute === '/kiosk') {
		return (
			<>
				<Toaster />
				<SignedIn>
					<KioskSession>{null}</KioskSession>
				</SignedIn>
				<SignedOut>
					<div className="flex items-center justify-center min-h-screen bg-gray-50">
						<SignIn routing="hash" />
					</div>
				</SignedOut>
			</>
		);
	}

	// Update route when URL changes
	useEffect(() => {
		const handlePopState = () => {
			setCurrentRoute(window.location.pathname);
		};
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	return (
		<>
			<Toaster />
			<SignedIn>
				<AuthenticatedApp
					currentRoute={currentRoute}
					setCurrentRoute={setCurrentRoute}
					deviceId={globalDeviceId} // ✅ Pass it down
				/>
			</SignedIn>
			<SignedOut>
				<div className="flex items-center justify-center min-h-screen bg-gray-50">
					<div className="w-full max-w-md">
						{/* Logo Section */}
						<div className="flex justify-center mb-6">
							<img
								src="/logo.png"
								alt="El-Elyon Properties LLC Logo"
								className="h-16 w-auto"
								onError={(e) => {
									e.currentTarget.style.display = 'none';
									const fallback = e.currentTarget
										.nextElementSibling as HTMLElement;
									if (fallback) fallback.classList.remove('hidden');
								}}
							/>
							<div className="text-3xl font-bold hidden">
								<span className="text-black">El-Elyon</span>
								<span className="text-blue-600"> Properties LLC</span>
							</div>
						</div>

						<SignIn routing="hash" signUpUrl={undefined} />

						{/* Footer */}
						<div className="mt-6 text-center">
							<p className="text-xs text-gray-500">
								powered by{' '}
								<span className="font-semibold text-gray-700">
									Bold Ideas Innovations Ltd
								</span>
							</p>
						</div>
					</div>
				</div>
			</SignedOut>
		</>
	);
}

function AuthenticatedApp({
	currentRoute,
	setCurrentRoute,
	deviceId, // ✅ Receive deviceId as prop
}: {
	currentRoute: string;
	setCurrentRoute: (route: string) => void;
	deviceId: string | null;
}) {
	const {user} = useUser();

	// ✅ Wait for deviceId to be ready
	const [deviceReady, setDeviceReady] = useState(false);

	useEffect(() => {
		if (deviceId !== null) {
			setDeviceReady(true);
		}
	}, [deviceId]);

	// Get session info and device authorization
	const sessionInfo = useQuery(api.access.getSessionInfo);
	const role = useQuery(api.settings.getUserRole);
	const deviceAuthorization = useQuery(
		user?.id && deviceReady ? api.employees.checkDeviceAuthorization : 'skip',
		user?.id && deviceReady
			? {clerkUserId: user.id, deviceId: deviceId!}
			: 'skip'
	);

	// Debug logging
	useEffect(() => {
		if (user?.id && deviceId) {
			console.log('🔑 Clerk User ID:', user.id);
			console.log('📧 Email:', user.primaryEmailAddress?.emailAddress);
			console.log('💻 Device ID:', deviceId);
			console.log('🔑 Role:', role);
		}
	}, [user, deviceId, role]);

	// Handle automatic routing based on user role
	useEffect(() => {
		if (sessionInfo?.authenticated && sessionInfo.defaultRoute) {
			if (currentRoute === '/' && currentRoute !== sessionInfo.defaultRoute) {
				window.history.replaceState({}, '', sessionInfo.defaultRoute);
				setCurrentRoute(sessionInfo.defaultRoute);
			}
		}
	}, [sessionInfo, currentRoute, setCurrentRoute]);

	// Loading state
	if (
		!user ||
		sessionInfo === undefined ||
		role === undefined ||
		!deviceReady
	) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="text-4xl mb-4">⏳</div>
					<p className="text-gray-600">Loading your profile...</p>
				</div>
			</div>
		);
	}

	// Device authorization check
	if (deviceAuthorization === undefined) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="text-4xl mb-4">🔐</div>
					<p className="text-gray-600">Checking device authorization...</p>
				</div>
			</div>
		);
	}

	if (deviceAuthorization && !deviceAuthorization.isAuthorized) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-gray-50">
				<div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
					<div className="text-6xl mb-4">🚫</div>
					<h2 className="text-2xl font-bold text-gray-900 mb-4">
						Unauthorized Device
					</h2>
					<p className="text-gray-600 mb-2">
						This device is not authorized for your account.
					</p>
					<p className="text-sm text-gray-500 mb-6">
						Reason: {deviceAuthorization.reason}
					</p>
					<p className="text-sm text-gray-600">
						Please use your assigned company device or contact your
						administrator.
					</p>
				</div>
			</div>
		);
	}

	// Handle kiosk mode
	if (role?.isKiosk) {
		return <KioskSession>{null}</KioskSession>;
	}

	// If user has no role, show pending page
	if (!sessionInfo?.role) {
		return (
			<PendingPage message="Your account is pending approval. An administrator will assign you a role soon." />
		);
	}

	// Admin portal
	if (currentRoute.startsWith('/admin')) {
		return (
			<AccessControl route={currentRoute}>
				<AdminPortal />
			</AccessControl>
		);
	}

	// Care portal
	if (currentRoute.startsWith('/care')) {
		return (
			<AccessControl route={currentRoute}>
				<CarePortal />
			</AccessControl>
		);
	}

	// Default routing based on role
	if (sessionInfo.role === 'admin') {
		return (
			<AccessControl route="/admin">
				<AdminPortal />
			</AccessControl>
		);
	}

	if (sessionInfo.role === 'supervisor' || sessionInfo.role === 'staff') {
		return (
			<AccessControl route="/care">
				<CarePortal />
			</AccessControl>
		);
	}

	// Fallback
	return <PendingPage />;
}

export default App;
