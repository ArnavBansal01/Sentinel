import { RouteTrace } from "./CargoVisuals";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Globe2, ShieldCheck, Route } from "lucide-react";
import { useSentinel } from "@/lib/sf/store";

export function OverviewHero() {
  const { state } = useSentinel();
  return (
    <section className="overview-hero">
      <img
        src="/ocean-freight.png"
        alt="A container ship navigating open teal water"
        className="overview-hero-image"
      />
      <div className="overview-hero-copy">
        <span className="hero-eyebrow">
          <span /> YOUR NETWORK. ONE CLEAR PICTURE.
        </span>
        <h2>
          Stay ahead of
          <br />
          <span>every disruption.</span>
        </h2>
        <p>
          From the first signal to the next best move.
          <br className="hidden sm:block" /> Your supply chain, in full perspective.
        </p>
        <Link to="/shipments" className="hero-link">
          Explore shipments <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="hero-route-art">
        <span>CONNECTED. FROM ORIGIN TO OPPORTUNITY.</span>
        <RouteTrace />
      </div>
      <div className="hero-caption">
        <Globe2 size={14} />
        <span>GLOBAL OPERATIONS</span>
        <span className="hero-caption-mode">{state.systemStatus.mode} DATA</span>
      </div>
    </section>
  );
}

export function WorkspaceIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="workspace-intro">
      <div>
        <p className="label-xs">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="workspace-intro-icon">
        <Route size={25} />
      </div>
    </div>
  );
}

export function SafetyNote() {
  return (
    <div className="safety-note">
      <ShieldCheck size={17} />
      <span>Built for confident decisions.</span>
      <span>Policy checks and human oversight at every critical step.</span>
    </div>
  );
}
