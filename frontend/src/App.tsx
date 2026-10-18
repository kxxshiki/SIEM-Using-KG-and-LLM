import { Navigate, Route, Routes } from "react-router-dom";
import { PublicOnly, RequireAdmin, RequireAuth } from "@/components/routing/guards";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import VerifyAccount from "@/pages/VerifyAccount";
import VerifyEmailLink from "@/pages/VerifyEmailLink";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Alerts from "@/pages/Alerts";
import UploadLogs from "@/pages/UploadLogs";
import Approvals from "@/pages/Approvals";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/verify" element={<PublicOnly><VerifyAccount /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      {/* Opened from emails; must work even if someone is already signed in */}
      <Route path="/verify-email" element={<VerifyEmailLink />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/upload" element={<UploadLogs />} />
        <Route element={<RequireAdmin />}>
          <Route path="/admin/approvals" element={<Approvals />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}