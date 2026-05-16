import { signOut } from "@logto/next/server-actions";

import { AuthChipMenu } from "@/components/auth-chip-menu";
import { logtoConfig } from "@/lib/logto";
import { ensureCurrentUser } from "@/lib/users";

export async function AuthChip() {
  const user = await ensureCurrentUser();
  if (!user) return null;

  const label = user.email || user.displayName || user.logtoId;

  return (
    <AuthChipMenu
      label={label}
      onSignOut={async () => {
        "use server";
        await signOut(logtoConfig);
      }}
    />
  );
}
