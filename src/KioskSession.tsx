import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import SelfieCapture from "./components/SelfieCapture";
import AutoLock from "./components/AutoLock";
import QuickSignOut from "./components/QuickSignOut";
import LocationBanner from "./components/LocationBanner";
import ResidentCase from "./components/ResidentCase";
import KioskPairingScreen from "./components/KioskPairingScreen";

export default function KioskSession({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [selfie, setSelfie] = useState<Id<"_storage"> | null>(null);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isPaired, setIsPaired] = useState(false);

  // Check for existing pairing on mount
  useEffect(() => {
    const storedDeviceId = localStorage.getItem('kioskDeviceId');
    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
      setIsPaired(true);
    }
  }, []);

  const kiosk = useQuery(api.kiosk.getKioskByDeviceId, deviceId ? { deviceId } : "skip");
  const config = useQuery(api.settings.getAppSettings, {});
  const updateLastSeen = useMutation(api.kiosk.updateKioskLastSeen);

  // Update last seen periodically
  useEffect(() => {
    if (deviceId && kiosk?.isActive) {
      const interval = setInterval(() => {
        updateLastSeen({ deviceId });
      }, 30000); // Every 30 seconds

      return () => clearInterval(interval);
    }
  }, [deviceId, kiosk?.isActive, updateLastSeen]);

  // Simulate user session (replace with real user info)
  const user = useQuery(api.auth.loggedInUser);
const userRole = useQuery(api.settings.getUserRole);

  // Resident selection for demo (in real app, this would be routed)
  const [selectedResidentId, setSelectedResidentId] = useState<Id<"residents"> | null>(null);
  const residents = useQuery(api.people.listResidents, {});

  // Show pairing screen if not paired
  if (!isPaired || !deviceId) {
    return (
      <KioskPairingScreen
        onPairingComplete={(deviceData) => {
          setDeviceId(deviceData.deviceId);
          setIsPaired(true);
        }}
      />
    );
  }

  // Check if kiosk is still active
  if (kiosk === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Kiosk Not Found</h1>
          <p className="text-gray-600 mb-4">This kiosk is not registered or has been removed.</p>
          <button
            onClick={() => {
              localStorage.removeItem('kioskDeviceId');
              localStorage.removeItem('kioskLocation');
              localStorage.removeItem('kioskLabel');
              setIsPaired(false);
              setDeviceId(null);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Re-pair Kiosk
          </button>
        </div>
      </div>
    );
  }

  if (kiosk && !kiosk.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-yellow-600 mb-4">Kiosk Disabled</h1>
          <p className="text-gray-600">This kiosk has been disabled by an administrator.</p>
          <p className="text-sm text-gray-500 mt-2">Contact support if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  // Only allow staff, supervisor, or admin (or users without a role yet - they might be setting up)
  if (userRole && userRole.role && !["staff", "supervisor", "admin"].includes(userRole.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Not Authorized</h1>
          <p className="text-gray-600">You do not have permission to use this kiosk.</p>
          <p className="text-sm text-gray-500 mt-2">Only staff, supervisors, and admins can access kiosk mode.</p>
        </div>
      </div>
    );
  }

  // Selfie enforcement logic
  if (user && config && config.selfieEnforced && !selfie) {
    return (
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold">Selfie Required</h2>
        <SelfieCapture
          onCapture={async (storageId: Id<"_storage">) => {
            setSelfie(storageId);
            // Log audit event would go here
          }}
          onCancel={() => setSelfieError("Selfie capture cancelled")}
        />
        {selfieError && <div className="text-red-600">{selfieError}</div>}
      </div>
    );
  }

  // Auto-lock on inactivity
  if (locked) {
    return (
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold">Session Locked</h2>
        <button
          className="button"
          onClick={() => setLocked(false)}
        >
          Unlock
        </button>
        <QuickSignOut />
      </div>
    );
  }

  return (
    <div>
      <LocationBanner location={kiosk?.location ?? "Unknown"} />
      <AutoLock onLock={() => setLocked(true)} />
      <QuickSignOut />
      {/* Resident selection UI */}
      <div className="my-4">
        <h3 className="font-semibold mb-2">Residents</h3>
        {residents === undefined ? (
          <div>Loading residents...</div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {residents.map((r: any) => (
              <li key={r.id}>
                <button
                  className={`px-2 py-1 rounded ${selectedResidentId === r.id ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                  onClick={() => setSelectedResidentId(r.id)}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Resident case folder */}
      {selectedResidentId && (
        <ResidentCase residentId={selectedResidentId} />
      )}
      {children}
    </div>
  );
}
