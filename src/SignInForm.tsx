'use client';
import {SignIn, SignUp} from '@clerk/clerk-react';
import {useQuery} from 'convex/react';
import {api} from '../convex/_generated/api';
import {useEffect, useState} from 'react';

export function SignInForm() {
	// Check if admin exists - NO AUTH REQUIRED (public query)
	const hasAdmin = useQuery(api.employees.hasAdminUser);
	const [showSignUp, setShowSignUp] = useState(false);

	// Reset to sign in when hasAdmin changes
	useEffect(() => {
		if (hasAdmin !== undefined) {
			setShowSignUp(!hasAdmin); // Show signup only if no admin exists
		}
	}, [hasAdmin]);

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
					- If NO admin exists → Show SignUp for first admin creation
					- If admin exists → Show SignIn only (employees use credentials)
				*/}
				{!hasAdmin && showSignUp ? (
					<>
						<SignUp routing="hash" signInUrl="#" afterSignUpUrl="/" />
						<div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
							<p className="text-sm text-green-800 text-center">
								<strong>First Time Setup:</strong> Create the first admin
								account to get started.
							</p>
						</div>
					</>
				) : (
					<>
						<SignIn
							routing="hash"
							signUpUrl={undefined} // No signup option for employees
						/>
						<div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
							<p className="text-sm text-blue-800 text-center">
								<strong>Employee?</strong> Please use the credentials provided
								by your administrator.
							</p>
						</div>
					</>
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
