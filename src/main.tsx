import React from 'react';
import {createRoot} from 'react-dom/client';
import {ConvexReactClient} from 'convex/react';
import {ClerkProvider, useAuth} from '@clerk/clerk-react';
import {ConvexProviderWithClerk} from 'convex/react-clerk';
import './index.css';
import App from './App';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
	throw new Error('Missing Clerk Publishable Key');
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
			<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
				<App />
			</ConvexProviderWithClerk>
		</ClerkProvider>
	</React.StrictMode>
);