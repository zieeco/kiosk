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

// =========================

// src/lib/deviceId.ts
const STORAGE_KEY = 'kiosk_device_id';

// Safe localStorage helpers
function safeStorageGet(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeStorageSet(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Silently ignore (e.g., private browsing)
	}
}

/**
 * Generates a stable, deterministic fingerprint using browser + hardware signals.
 * Same device → same fingerprint → same device ID.
 */
async function generateStableFingerprint(): Promise<string> {
	// Collect stable device characteristics
	const components = [
		navigator.userAgent,
		navigator.platform,
		String(navigator.hardwareConcurrency ?? 0),
		// deviceMemory is only available in secure contexts (HTTPS/localhost)
		String(
			(navigator as Navigator & {deviceMemory?: number}).deviceMemory ?? 0
		),
		`${screen.width}x${screen.height}`,
		String(screen.colorDepth),
		navigator.language,
		await getCanvasFingerprint(),
	];

	const data = components.join('|');
	const encoder = new TextEncoder();
	const hashBuffer = await crypto.subtle.digest(
		'SHA-256',
		encoder.encode(data)
	);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Canvas fingerprinting for additional entropy.
 * Helps distinguish identical hardware/browser configs.
 */
async function getCanvasFingerprint(): Promise<string> {
	try {
		const canvas = document.createElement('canvas');
		canvas.width = 200;
		canvas.height = 50;
		const ctx = canvas.getContext('2d');
		if (!ctx) return 'no-canvas';

		// Draw text with anti-aliasing (varies by GPU/drivers)
		ctx.textBaseline = 'top';
		ctx.font = "18px 'Helvetica', Arial, sans-serif";
		ctx.fillStyle = '#f60';
		ctx.fillRect(0, 0, 200, 50);
		ctx.fillStyle = '#000';
		ctx.fillText('KioskAuth', 5, 5);

		return canvas.toDataURL();
	} catch {
		return 'canvas-error';
	}
}

/**
 * Get or generate a persistent device ID.
 * - If already stored: return it.
 * - If not: generate deterministic ID from fingerprint and store it.
 *
 * ⚠️ This function is async because fingerprinting uses crypto + canvas.
 */
export async function getOrCreateDeviceId(): Promise<string> {
	const existing = safeStorageGet(STORAGE_KEY);
	if (existing) {
		return existing;
	}

	const fingerprint = await generateStableFingerprint();
	// Use 16 hex chars = 64 bits of entropy (more than enough for 6 devices)
	const deviceId = `device_${fingerprint.substring(0, 16)}`;
	safeStorageSet(STORAGE_KEY, deviceId);
	return deviceId;
}

/**
 * For debugging: log device info and ID (use during kiosk setup)
 */
export async function debugDeviceId(): Promise<void> {
	const id = await getOrCreateDeviceId();
	console.log('✅ Kiosk Device ID:', id);
	console.log('ℹ️  Device Info:', {
		userAgent: navigator.userAgent,
		platform: navigator.platform,
		screen: `${screen.width}x${screen.height}`,
		language: navigator.language,
		hardwareConcurrency: navigator.hardwareConcurrency,
		deviceMemory: (navigator as any).deviceMemory,
	});
}


