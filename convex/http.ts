import {httpRouter} from 'convex/server';
import {httpAction} from './_generated/server';
import {internal} from './_generated/api';

const http = httpRouter();

/**
 * Clerk Webhook Endpoint
 * Configure in Clerk Dashboard → Webhooks:
 * - URL: https://your-deployment.convex.site/clerk-webhook
 * - Events: user.created, user.updated, user.deleted
 */
http.route({
	path: '/clerk-webhook',
	method: 'POST',
	handler: httpAction(async (ctx, request) => {
		// Get headers
		const svix_id = request.headers.get('svix-id');
		const svix_timestamp = request.headers.get('svix-timestamp');
		const svix_signature = request.headers.get('svix-signature');

		if (!svix_id || !svix_timestamp || !svix_signature) {
			return new Response('Missing svix headers', {status: 400});
		}

		// Get the raw body
		const payload = await request.text();

		console.log('📨 Received webhook request');

		try {
			// Call internal action to process webhook
			await ctx.runAction(internal.clerkActions.handleClerkWebhook, {
				payload,
				headers: {
					svix_id,
					svix_timestamp,
					svix_signature,
				},
			});

			console.log('✅ Webhook processed successfully');

			return new Response(JSON.stringify({success: true}), {
				status: 200,
				headers: {'Content-Type': 'application/json'},
			});
		} catch (error) {
			console.error('❌ Webhook processing failed:', error);
			return new Response(
				JSON.stringify({
					error:
						error instanceof Error
							? error.message
							: 'Webhook processing failed',
				}),
				{
					status: 500,
					headers: {'Content-Type': 'application/json'},
				}
			);
		}
	}),
});

export default http;
