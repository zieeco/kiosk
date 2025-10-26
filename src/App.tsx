// signin.tsx and app.tsx
'use client';
import {SignIn} from '@clerk/clerk-react';
import {useQuery} from 'convex/react';
import {api} from '../convex/_generated/api';

export function SignInForm() {
	// Check if admin exists - NO AUTH REQUIRED (public query)
	const hasAdmin = useQuery(api.employees.hasAdminUser);

	// Show loading while checking
	if (hasAdmin === undefined) {
		return (
			<div className="w-full min-h-screen bg-[rgb(248_250_252)] dark:bg-neutral-950 px-4 py-10 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full min-h-screen bg-[rgb(248_250_252)] dark:bg-neutral-950 px-4 py-10 flex items-center justify-center">
			{/* Centered, reduced-width container */}
			<div className="mx-auto w-full max-w-[440px] sm:max-w-[480px] md:max-w-[520px] lg:max-w-[560px] bg-white/95 dark:bg-neutral-900/95 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-lg p-6 sm:p-7 md:p-8">
				{/* Logo Section */}
				<div className="flex justify-center mb-4">
					<img
						src="/logo.png"
						alt="El-Elyon Properties LLC Logo"
						className="h-16 w-auto"
						onError={(e) => {
							e.currentTarget.style.display = 'none';
							e.currentTarget.nextElementSibling?.classList.remove('hidden');
						}}
					/>
					<div className="text-3xl font-bold hidden">
						<span className="text-black">El-Elyon</span>
						<span className="text-blue-600"> Properties LLC</span>
					</div>
				</div>

				{/* 
					CONDITIONAL SIGNUP:
					- If NO admin exists → Show SignIn WITH SignUp option (for first admin)
					- If admin exists → Show SignIn ONLY (no signup for employees)
				*/}
				<SignIn
					routing="hash"
					signUpUrl={hasAdmin ? undefined : '/sign-up'} // ← KEY LINE: Conditional signup
				/>

				{/* Info Message for Employees */}
				{hasAdmin && (
					<div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
						<p className="text-sm text-blue-800 text-center">
							<strong>Employee?</strong> Please use the credentials provided by
							your administrator.
						</p>
					</div>
				)}

				{/* Info Message for First Admin */}
				{!hasAdmin && (
					<div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
						<p className="text-sm text-green-800 text-center">
							<strong>First Time Setup:</strong> Create the first admin account
							to get started.
						</p>
					</div>
				)}

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
	);
}




// app.tsx
/* eslint-disable react-hooks/rules-of-hooks */
import {useQuery, useMutation, useAction} from 'convex/react';
import {SignIn, SignedIn, SignedOut} from '@clerk/clerk-react';
import {useUser} from '@clerk/clerk-react';
import {api} from '../convex/_generated/api';
import {Toaster, toast} from 'sonner'; // Added toast import
import KioskSession from './KioskSession';
import GuardianChecklistPublic from './components/GuardianChecklistPublic';
import AccessControl from './components/AccessControl';
import AdminPortal from './components/AdminPortal';
import CarePortal from './components/CarePortal';
import PendingPage from './components/PendingPage';
import {useEffect, useState} from 'react';
import {getDeviceId, initializeDeviceId} from './lib/device';

function App() {
	const urlParams = new URLSearchParams(window.location.search);
	const checklistToken = urlParams.get('checklist');
	const [currentRoute, setCurrentRoute] = useState(window.location.pathname);
	const [deviceInitialized, setDeviceInitialized] = useState(false);

	// Initialize device ID on app load
	useEffect(() => {
		initializeDeviceId()
			.then((deviceId) => {
				console.log('📱 Device initialized:', deviceId);
				setDeviceInitialized(true);
			})
			.catch((error) => {
				console.error('❌ Failed to initialize device:', error);
				setDeviceInitialized(true); // Continue anyway with fallback ID
			});
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

	// Wait for device to initialize
	if (!deviceInitialized) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="text-4xl mb-4">🔐</div>
					<p className="text-gray-600">Initializing device...</p>
				</div>
			</div>
		);
	}

	return (
		<>
			<Toaster />
			<SignedIn>
				<AuthenticatedApp
					currentRoute={currentRoute}
					setCurrentRoute={setCurrentRoute}
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
}: {
	currentRoute: string;
	setCurrentRoute: (route: string) => void;
}) {
	const {user} = useUser();
	const deviceId = getDeviceId();

	// ============================================================================
	// 🆕 SELF-HEALING AUTH - Auto-sync user if missing from database
	// ============================================================================
	const [syncAttempted, setSyncAttempted] = useState(false);
	const userCheck = useQuery(api.auth.ensureUserExists);
	const autoSync = useMutation(api.auth.autoSyncUser);

	// Auto-sync user if they don't exist in database
	useEffect(() => {
		if (userCheck && userCheck.needsSync && !syncAttempted) {
			console.log('🔄 Auto-syncing user to database...');
			setSyncAttempted(true);

			autoSync()
				.then((result) => {
					console.log('✅ User synced:', result);
					if (result.isFirstAdmin) {
						toast.success('Welcome! You are the first admin.');
					}
				})
				.catch((error) => {
					console.error('❌ Auto-sync failed:', error);
					toast.error('Failed to sync user. Please refresh the page.');
				});
		}
	}, [userCheck, syncAttempted, autoSync]);
	// ============================================================================

	// Get session info and device authorization
	const sessionInfo = useQuery(api.access.getSessionInfo);
	const role = useQuery(api.settings.getUserRole);

	// Use our new devices.checkDevice query for device validation
	const deviceCheck = useQuery(api.devices.checkDevice, {deviceId});

	// Record device usage when user logs in successfully
	const recordUsage = useMutation(api.devices.recordDeviceUsage);

	// Debug logging
	useEffect(() => {
		if (user?.id) {
			console.log('🔑 Clerk User ID:', user.id);
			console.log('📧 Email:', user.primaryEmailAddress?.emailAddress);
			console.log('💻 Device ID:', deviceId);
			console.log('🔑 Role:', role);
			console.log('📱 Device Check:', deviceCheck);
			console.log('🔍 User Check:', userCheck); // Added
		}
	}, [user, deviceId, role, deviceCheck, userCheck]);

	// Record device usage when authentication is successful
	useEffect(() => {
		if (user?.id && deviceCheck?.isRegistered && deviceCheck?.isActive) {
			recordUsage({deviceId}).catch((error) => {
				console.error('Failed to record device usage:', error);
			});
		}
	}, [
		user?.id,
		deviceCheck?.isRegistered,
		deviceCheck?.isActive,
		deviceId,
		recordUsage,
	]);

	// Handle automatic routing based on user role
	useEffect(() => {
		if (sessionInfo?.authenticated && sessionInfo.defaultRoute) {
			if (currentRoute === '/' && currentRoute !== sessionInfo.defaultRoute) {
				window.history.replaceState({}, '', sessionInfo.defaultRoute);
				setCurrentRoute(sessionInfo.defaultRoute);
			}
		}
	}, [sessionInfo, currentRoute, setCurrentRoute]);

	// Loading state - Added userCheck condition
	if (
		!user ||
		userCheck === undefined ||
		(userCheck!.needsSync && !syncAttempted) ||
		sessionInfo === undefined ||
		role === undefined ||
		deviceCheck === undefined
	) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="text-4xl mb-4">⏳</div>
					<p className="text-gray-600">
						{userCheck?.needsSync
							? 'Setting up your account...'
							: 'Loading your profile...'}
					</p>
				</div>
			</div>
		);
	}

	// Device authorization check - Block if device not registered or inactive
	// BUT: Allow admins to bypass device restrictions
	if (!deviceCheck.isRegistered || !deviceCheck.isActive) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-red-50">
				<div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
					<div className="text-6xl mb-4">🚫</div>
					<h2 className="text-2xl font-bold text-gray-900 mb-4">
						Unauthorized Device
					</h2>
					<p className="text-gray-600 mb-2">{deviceCheck.message}</p>
					<div className="bg-gray-50 p-4 rounded-lg mt-4 mb-4">
						<p className="text-xs text-gray-500 mb-2">Device ID:</p>
						<code className="text-xs bg-white px-3 py-2 rounded border border-gray-200 block break-all">
							{deviceId}
						</code>
					</div>
					<p className="text-sm text-gray-600">
						Please contact your administrator to register this device.
					</p>
				</div>
			</div>
		);
	}

	// Show admin badge if user is accessing from unrestricted device
	const isAdminBypass = deviceCheck.isAdmin;

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
