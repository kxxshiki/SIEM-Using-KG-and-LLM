import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ParticleNetworkBackground from "@/components/auth/ParticleNetworkBackground";
import ComingSoon from "@/components/ComingSoon";
import PageSkeleton from "@/components/PageSkeleton";
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
const Reports = lazy(() => import("@/pages/Reports"));
const ThreatGraph = lazy(() => import("@/pages/ThreatGraph"));
const Approvals = lazy(() => import("@/pages/Approvals"));
const ConnectedAccounts = lazy(() => import("@/pages/ConnectedAccounts"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const PasswordSecurity = lazy(() => import("@/pages/PasswordSecurity"));
const AccountInformation = lazy(() => import("@/pages/AccountInformation"));
const AccountSessions = lazy(() => import("@/pages/AccountSessions"));
const PasswordChangeConfirm = lazy(() => import("@/pages/PasswordChangeConfirm"));
const Feedback = lazy(() => import("@/pages/Feedback"));

export default function App() {
  return (
    <div className="relative isolate min-h-screen">
      {/* Animated purple network behind the application content */}
      <ParticleNetworkBackground />

      {/* Keep all routes above the background canvas */}
      <div className="relative z-10">
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/login/phone" element={<PublicOnly><PhoneLogin /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
            <Route path="/verify" element={<PublicOnly><VerifyAccount /></PublicOnly>} />
            <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
            <Route path="/verify-email" element={<VerifyEmailLink />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/account/password/confirm" element={<PasswordChangeConfirm />} />

            <Route element={<RequireAuth />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload-logs" element={<UploadLogs />} />
              <Route path="/upload" element={<UploadLogs />} />
              <Route path="/sources" element={<UploadLogs />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/spam" element={<ComingSoon title="Spam" />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/threat-graph" element={<ThreatGraph />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/security" element={<PasswordSecurity />} />
              <Route path="/settings/information" element={<AccountInformation />} />
              <Route path="/settings/sessions" element={<AccountSessions />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/notifications" element={<ComingSoon title="Notifications" />} />
              <Route path="/account/connections" element={<ConnectedAccounts />} />

              <Route element={<RequireAdmin />}>
                <Route path="/admin/approvals" element={<Approvals />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}
