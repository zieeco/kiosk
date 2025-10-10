/**
 * Device ID Generator
 * Creates a persistent, unique device identifier based on browser fingerprint
 * This is more reliable than UUID as it persists across storage clearing
 */

const DEVICE_ID_KEY = 'kiosk_device_id';

/**
 * Get or generate device ID
 * Priority: localStorage > fingerprint generation
 */
export function getDeviceId(): string {
	// Check localStorage first
	let deviceId = localStorage.getItem(DEVICE_ID_KEY);

	if (deviceId) {
		return deviceId;
	}

	// Generate new device ID based on browser fingerprint
	deviceId = generateFingerprint();
	localStorage.setItem(DEVICE_ID_KEY, deviceId);

	return deviceId;
}

/**
 * Generate a unique fingerprint based on browser/device characteristics
 */
function generateFingerprint(): string {
	const components: string[] = [];

	// Navigator properties
	components.push(navigator.userAgent);
	components.push(navigator.language);
	components.push(String(navigator.hardwareConcurrency || 0));
	components.push(String(navigator.maxTouchPoints || 0));

	// Screen properties
	components.push(String(screen.width));
	components.push(String(screen.height));
	components.push(String(screen.colorDepth));
	components.push(String(screen.pixelDepth));

	// Timezone offset
	components.push(String(new Date().getTimezoneOffset()));

	// Platform
	components.push(navigator.platform);

	// Available fonts (if supported)
	if ('fonts' in document) {
		try {
			components.push('fonts_supported');
		} catch {
			components.push('fonts_not_supported');
		}
	}

	// Combine all components and hash
	const combined = components.join('|');
	return hashString(combined);
}

/**
 * Simple hash function to convert fingerprint to hex string
 */
function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}

	// Convert to hex string with prefix and timestamp suffix for uniqueness
	const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
	const timestamp = Date.now().toString(36);
	return `device_${hashHex}_${timestamp}`;
}

/**
 * Clear device ID (useful for testing or re-registration)
 */
export function clearDeviceId(): void {
	localStorage.removeItem(DEVICE_ID_KEY);
}

/**
 * Check if device ID exists in storage
 */
export function hasDeviceId(): boolean {
	return localStorage.getItem(DEVICE_ID_KEY) !== null;
}

/**
 * Get detailed device information for debugging/display
 */
export function getDeviceInfo() {
	return {
		deviceId: getDeviceId(),
		userAgent: navigator.userAgent,
		platform: navigator.platform,
		language: navigator.language,
		screenResolution: `${screen.width}x${screen.height}`,
		colorDepth: screen.colorDepth,
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		timezoneOffset: new Date().getTimezoneOffset(),
	};
}

/**
 * Validate if a device ID has the correct format
 */
export function isValidDeviceId(deviceId: string): boolean {
	// Check format: device_[8 hex chars]_[base36 timestamp]
	const pattern = /^device_[0-9a-f]{8}_[0-9a-z]+$/;
	return pattern.test(deviceId);
}
