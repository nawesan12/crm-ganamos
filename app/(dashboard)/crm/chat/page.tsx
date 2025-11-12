import { AuthGuard } from "@/components/auth/AuthGuard";
import OperatorChatPanel from "@/components/OperatorChatPanel";

export default function ChatsPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <OperatorChatPanel />
    </AuthGuard>
  );
}
