import { signIn, signOut } from "@logto/next/server-actions";

import { Button } from "@/components/ui/button";
import { logtoConfig } from "@/lib/logto";
import { ensureCurrentUser } from "@/lib/users";

export async function AuthChip() {
  const user = await ensureCurrentUser();

  if (!user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn(logtoConfig);
        }}
      >
        <Button type="submit" variant="ghost" size="sm">
          Sign in
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-muted-foreground">
        {user.email || user.displayName || user.logtoId}
      </span>
      <form
        action={async () => {
          "use server";
          await signOut(logtoConfig);
        }}
      >
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
