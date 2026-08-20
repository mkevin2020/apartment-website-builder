import TenantApprovalsPage from "@/app/admin/components/tenant-approvals";
import { SessionGuard } from "@/components/auth/session-guard";

export default function AdminTenantApprovalsPage() {
  return (
    <>
      <SessionGuard sessionKey="admin_session" />
      <TenantApprovalsPage />
    </>
  );
}
