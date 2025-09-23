import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import SelfieCapture from "./components/SelfieCapture";
import AutoLock from "./components/AutoLock";
import QuickSignOut from "./components/QuickSignOut";
import LocationBanner from "./components/LocationBanner";
import ResidentCase from "./components/ResidentCase";

// Simulate deviceId for kiosk (in real deployment, use a persistent device identifier)
const deviceId = "kiosk-001"; // TODO: Replace with real device ID logic

export default function KioskSession({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [selfieError, setSelfieError] = useState<string | null>(null);

  const kiosk = useQuery(api.kiosk.getKioskByDevice, { deviceId });
  const config = useQuery(api.kiosk.getConfig, {});
  const logAudit = useMutation(api.kiosk.logAudit);

  // Simulate user session (replace with real user info)
  const user = useQuery(api.auth.loggedInUser);

  // Resident selection for demo (in real app, this would be routed)
  const [selectedResidentId, setSelectedResidentId] = useState<Id<"residents"> | null>(null);
  const residents = useQuery(api.kiosk.listResidents, {});

  // Selfie enforcement logic
  if (user && config && config.selfieEnforced && !selfie) {
    return (
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold">Selfie Required</h2>
        <SelfieCapture
          onCapture={async (dataUrl) => {
            setSelfie(dataUrl);
            await logAudit({
              event: "selfie",
              deviceId,
              location: kiosk?.location ?? "unknown",
              details: undefined,
            });
          }}
          onError={(err) => setSelfieError(err)}
        />
        {selfieError && <div className="text-red-600">{selfieError}</div>}
      </div>
    );
  }

  // Auto-lock on inactivity
  if (locked) {
    logAudit({
      event: "auto-lock",
      deviceId,
      location: kiosk?.location ?? "unknown",
      details: undefined,
    });
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
              <li key={r._id}>
                <button
                  className={`px-2 py-1 rounded ${selectedResidentId === r._id ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                  onClick={() => setSelectedResidentId(r._id)}
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
