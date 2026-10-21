import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ParticleNetworkBackground from "@/components/auth/ParticleNetworkBackground";
import ComingSoon from "@/components/ComingSoon";
import { PublicOnly, RequireAdmin, RequireAuth } from "@/components/routing/guards";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import PhoneLogin from "@/pages/PhoneLogin";
import VerifyAccount from "@/pages/VerifyAccount";
import VerifyEmailLink from "@/pages/VerifyEmailLink";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import OAuthCallback from "@/pages/OAuthCallback";

// Loaded on demand and prefetched from the login page
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Alerts = lazy(() => import("@/pages/Alerts"));
const UploadLogs = lazy(() => import("@/pages/UploadLogs"));
const Approvals = lazy(() => import("@/pages/Approvals"));
const ConnectedAccounts = lazy(() => import("@/pages/ConnectedAccounts"));
const SettingsPage = lazy(() => import("@/pages/Settings"));

export default function App() {
  return (
    <>
      {/* One always-moving network behind every page; it never restarts between pages */}
      <ParticleNetworkBackground />
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/login/phone" element={<PublicOnly><PhoneLogin /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/verify" element={<PublicOnly><VerifyAccount /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        {/* Opened from emails and by Google/GitHub; must work even if someone is signed in */}
        <Route path="/verify-email" element={<VerifyEmailLink />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        <Route element={<RequireAuth />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analytics" element={<ComingSoon title="Analytics" />} />
          <Route path="/threats" element={<ComingSoon title="Threats" />} />
          <Route path="/sources" element={<UploadLogs />} />
          <Route path="/upload" element={<UploadLogs />} />
          <Route path="/reports" element={<ComingSoon title="Reports" />} />
          <Route path="/indicators" element={<ComingSoon title="Indicators" />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/socco-pilot" element={<ComingSoon title="Socco-Pilot" />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/feedback" element={<ComingSoon title="Feedback" />} />
          <Route path="/account/connections" element={<ConnectedAccounts />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin/approvals" element={<Approvals />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}