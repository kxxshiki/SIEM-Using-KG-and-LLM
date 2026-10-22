import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function AccountInformation() {
  const { user } = useAuth();
  return (
    <section className="mx-auto max-w-xl space-y-5">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Account preferences</Link>
      <header><h1 className="text-2xl font-bold">Your information and permissions</h1><p className="mt-1 text-sm text-muted-foreground">Account details and access are managed securely by SIEM.</p></header>
      <div className="divide-y rounded-2xl border bg-card/85 px-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3 py-4"><Mail size={18} className="text-primary" /><div><p className="text-xs text-muted-foreground">Registered email</p><p className="font-medium">{user?.email ?? "Not available"}</p></div></div>
        <div className="flex items-center gap-3 py-4"><Shield size={18} className="text-primary" /><div><p className="text-xs text-muted-foreground">Access role</p><p className="font-medium capitalize">{user?.role ?? "Not available"}</p></div></div>
      </div>
      <p className="text-sm text-muted-foreground">Roles and data permissions are assigned by your administrator and cannot be changed from this page.</p>
    </section>
  );
}
