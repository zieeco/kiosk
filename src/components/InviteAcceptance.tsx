// This component is deprecated - employee invites are no longer used
// Employees are now created directly with passwords
export default function InviteAcceptance({ token }: { token: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-4">Invite System Deprecated</h2>
        <p className="text-center mb-6">
          Employee invites are no longer used. Please contact your administrator to create your account directly.
        </p>
        <button
          onClick={() => window.location.href = "/"}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Go to Sign In
        </button>
      </div>
    </div>
  );
}
