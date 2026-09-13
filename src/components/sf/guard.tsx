import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useSentinel } from "@/lib/sf/store";

/** Real session gate: unauthenticated users never reach operational routes. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { state, ready } = useSentinel();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !state.user) navigate({ to: "/login", replace: true });
  }, [ready, state.user, navigate]);

  if (!ready || !state.user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Loading control tower…</p>
      </div>
    );
  }
  return <>{children}</>;
}
