import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import AdminPortal from "./components/AdminPortal";
import CarePortal from "./components/CarePortal";
import SupervisorPortal from "./components/SupervisorPortal";
import BootstrapAdmin from "./components/BootstrapAdmin";
import InviteAcceptance from "./components/InviteAcceptance";
import EmployeeInviteAcceptance from "./components/EmployeeInviteAcceptance";
import GuardianChecklistPublic from "./components/GuardianChecklistPublic";
import KioskPairingScreen from "./components/KioskPairingScreen";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ResetPasswordPage from "./components/ResetPasswordPage";

function App() {
  const needsBootstrap = useQuery(api.auth.needsBootstrap);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [employeeInviteToken, setEmployeeInviteToken] = useState<string | null>(null);
  const [checklistToken, setChecklistToken] = useState<string | null>(null);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    const employeeInvite = params.get("employee_invite");
    const checklist = params.get("checklist");
    const pairing = params.get("pairing");
    const forgot = window.location.pathname === "/forgot";
    const reset = window.location.pathname === "/reset-password" || window.location.pathname.includes("reset-password");
    
    if (invite) setInviteToken(invite);
    if (employeeInvite) setEmployeeInviteToken(employeeInvite);
    if (checklist) setChecklistToken(checklist);
    if (pairing) setPairingToken(pairing);
    if (forgot) setIsForgotPassword(true);
    if (reset) setIsResetPassword(true);
  }, []);

  // Show forgot password page
  if (isForgotPassword) {
    return (
      <>
        <Toaster position="top-center" />
        <ForgotPasswordPage />
      </>
    );
  }

  // Show reset password page
  if (isResetPassword) {
    return (
      <>
        <Toaster position="top-center" />
        <ResetPasswordPage />
      </>
    );
  }

  // Show kiosk pairing screen
  if (pairingToken) {
    return (
      <>
        <Toaster position="top-center" />
        <KioskPairingScreen onPairingComplete={(deviceData) => {
          console.log("Pairing complete:", deviceData);
          window.location.href = "/";
        }} />
      </>
    );
  }

  // Show guardian checklist (public, no auth required)
  if (checklistToken) {
    return (
      <>
        <Toaster position="top-center" />
        <GuardianChecklistPublic token={checklistToken} />
      </>
    );
  }

  // Show employee invite acceptance page
  if (employeeInviteToken) {
    return (
      <>
        <Toaster position="top-center" />
        <EmployeeInviteAcceptance token={employeeInviteToken} />
      </>
    );
  }

  // Show invite acceptance page
  if (inviteToken) {
    return (
      <>
        <Toaster position="top-center" />
        <InviteAcceptance token={inviteToken} />
      </>
    );
  }

  // Show bootstrap page if no admin exists
  if (needsBootstrap === true) {
    return (
      <>
        <Toaster position="top-center" />
        <BootstrapAdmin />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>
    </>
  );
}

function AuthenticatedApp() {
  const user = useQuery(api.auth.loggedInUser);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user.role === "admin") {
    return <AdminPortal />;
  } else if (user.role === "supervisor") {
    return <SupervisorPortal />;
  } else if (user.role === "staff") {
    return <CarePortal />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-gray-600">No role assigned. Please contact your administrator.</p>
      </div>
    </div>
  );
}

export default App;
