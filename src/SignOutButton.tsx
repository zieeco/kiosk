'use client';
import {useQuery, useMutation} from 'convex/react';
import {api} from '../convex/_generated/api';
import {toast} from 'sonner';
import {useClerk} from '@clerk/clerk-react';

export function SignOutButton() {
	const {signOut: clerkSignOut} = useClerk();
	const currentShift = useQuery(api.care.getCurrentShift);
	const clockOut = useMutation(api.care.clockOut);

	const handleSignOut = async () => {
		// Check if user has an active shift
		if (currentShift) {
			const confirmed = window.confirm(
				'You are currently clocked in. Signing out will automatically clock you out. Do you want to continue?'
			);
			if (!confirmed) return;

			try {
				await clockOut({});
				toast.success('Clocked out successfully');
			} catch (error: any) {
				toast.error(
					'Failed to clock out: ' + (error.message || 'Unknown error')
				);
				return;
			}
		}

		// Sign out from Clerk
		await clerkSignOut();
	};

	return (
		<button
			className="px-4 py-2 rounded bg-white text-gray-700 border border-gray-200 font-semibold hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm hover:shadow"
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			onClick={handleSignOut}>
			Sign out
		</button>
	);
}
