import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function SignedOutPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-5xl leading-none tracking-tight">Signed out.</h1>
      <Button render={<Link href="/api/auth/sign-in" />} size="lg">
        Sign in
      </Button>
    </div>
  );
}
