import { ArrowLeft, Compass } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { AppShell, BrandMark, SurfaceCard } from "@/components/ui/fluxion-ui";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-5 py-8 md:px-8">
        <SurfaceCard className="mesh-highlight w-full max-w-3xl text-center">
          <div className="flex justify-center">
            <BrandMark compact />
          </div>
          <div className="mt-8 text-sm font-semibold uppercase tracking-[0.32em] text-[#9CA3AF]">Route not found</div>
          <div className="mt-4 font-display text-7xl font-semibold tracking-tight text-[#111827] md:text-8xl">404</div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-[#111827] md:text-4xl">
            That page is outside the current workspace map.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[#6B7280]">
            The requested route does not exist, may have moved, or the URL was entered incorrectly. Head back to the secure landing page and continue from there.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Return home
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/app">
                <Compass className="h-4 w-4" />
                Open workspace
              </Link>
            </Button>
          </div>
        </SurfaceCard>
      </main>
    </AppShell>
  );
};

export default NotFound;
