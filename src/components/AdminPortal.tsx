import React, {useState} from 'react';
import {useQuery} from 'convex/react';
import {useUser} from '@clerk/clerk-react';
import {api} from '../../convex/_generated/api';
import {SignOutButton} from '../SignOutButton';
import Sidebar from './Sidebar';
import AdminDashboard from './AdminDashboard';
import PeopleWorkspace from './PeopleWorkspace';
import ComplianceWorkspace from './ComplianceWorkspace';
import SettingsWorkspace from './SettingsWorkspace';
import ComplianceAlerts from './ComplianceAlerts';
import LocationsWorkspace from './LocationsWorkspace';
import GuardianChecklistWorkspace from './GuardianChecklistWorkspace';
import {DataCleanupWorkspace} from './DataCleanupWorkspace';

export default function AdminPortal() {
	const [activeView, setActiveView] = useState('dashboard');

	// ✅ FIX: Use Clerk's useUser hook instead of Convex auth
	const {user: clerkUser} = useUser();

	// ✅ Get current user info from our users.ts query
	const currentUser = useQuery(api.users.getCurrentUser);

	const renderContent = () => {
		switch (activeView) {
			case 'dashboard':
				return <AdminDashboard onNavigate={setActiveView} />;
			case 'people':
				return <PeopleWorkspace />;
			case 'compliance':
				return <ComplianceWorkspace />;
			case 'locations':
				return <LocationsWorkspace />;
			case 'guardian-checklists':
				return <GuardianChecklistWorkspace />;
			case 'data-cleanup':
				return <DataCleanupWorkspace />;
			case 'settings':
				return <SettingsWorkspace />;
			default:
				return <AdminDashboard onNavigate={setActiveView} />;
		}
	};

	// Show loading state while fetching user data
	if (!clerkUser || currentUser === undefined) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-gray-600">Loading admin portal...</p>
				</div>
			</div>
		);
	}

	// Convert Clerk user data to format expected by Sidebar
	const userForSidebar = {
		name:
			currentUser?.name || clerkUser.fullName || clerkUser.firstName || 'Admin',
		email:
			currentUser?.email || clerkUser.primaryEmailAddress?.emailAddress || '',
		role: currentUser?.role || 'admin',
	};

	return (
		<div className="flex h-screen bg-gray-50">
			<Sidebar
				user={userForSidebar}
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
