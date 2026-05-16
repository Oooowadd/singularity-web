import { getLogtoContext, signIn } from "@logto/next/server-actions";

import { Button } from "@/components/ui/button";
import { logtoConfig } from "@/lib/logto";

export default async function DashboardPage() {
  const { isAuthenticated } = await getLogtoContext(logtoConfig);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-8">
          <h1 className="font-display text-7xl leading-none">Singularity</h1>
          <form
            action={async () => {
              "use server";
              await signIn(logtoConfig);
            }}
          >
            <Button type="submit" size="lg" className="px-8">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <div className="flex flex-1 p-8" />;
}
