import React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export default function InviteAcceptance({ token }: { token: string }) {
  const inviteDetails = useQuery(api.employees.getInviteDetails, { token });
  const acceptInvite = useMutation(api.employees.acceptInvite);

  const handleAccept = async () => {
    try {
      await acceptInvite({ token });
      alert("Invite accepted successfully! You can now log in.");
      window.location.href = "/";
    } catch (err) {
      alert("Failed to accept invite: " + (err as Error).message);
    }
  };

  if (inviteDetails === undefined) {
    return <div>Loading...</div>;
  }
  if (!inviteDetails) {
    return <div>Invalid invite token.</div>;
  }

  if (inviteDetails.status === "already_accepted") {
    return <div>This invite has already been accepted.</div>;
  }
  if (inviteDetails.status === "expired") {
    return <div>This invite has expired.</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-4">Accept Invite</h2>
        <p className="text-center mb-6">
          You have been invited to join as <strong>{inviteDetails.employeeName}</strong> ({inviteDetails.workEmail}).
        </p>
        <button
          onClick={handleAccept}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Accept Invite & Sign In
        </button>
      </div>
    </div>
  );
}
