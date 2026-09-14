import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useSentinel } from "@/lib/sf/store";

export function RouteTrace({ className = "" }: { className?: string }) {
  return (
    <svg className={`route-trace ${className}`} viewBox="0 0 300 54" fill="none" aria-hidden="true">
      <path
        d="M8 40 C85 40 88 8 150 8 S222 40 292 40"
        stroke="currentColor"
        strokeOpacity=".18"
        strokeWidth="1.5"
      />
      <path
        className="route-trace-line"
        d="M8 40 C85 40 88 8 150 8 S222 40 292 40"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="5 6"
      />
      <circle cx="8" cy="40" r="4" fill="currentColor" />
      <circle cx="292" cy="40" r="4" fill="currentColor" />
      <circle cx="150" cy="8" r="7" fill="currentColor" fillOpacity=".15" />
      <circle cx="150" cy="8" r="3" fill="currentColor" />
    </svg>
  );
}

export function NetworkSpotlights() {
  const { state } = useSentinel();
  const cold = state.shipments.filter((s) => s.coldChain).length;
  const ocean = state.shipments.filter((s) => s.mode === "ocean").length;
  return (
    <div className="network-spotlights">
      <Link to="/shipments" className="network-spotlight">
        <img src="/container-terminal.png" alt="" loading="lazy" />
        <div>
          <span className="hero-eyebrow">CONNECTED OPERATIONS</span>
          <h3>
            A world of cargo.
            <br />
            Within reach.
          </h3>
          <p>{ocean} ocean shipments in your network</p>
          <span className="spotlight-cta">
            Explore the network <ArrowUpRight size={17} />
          </span>
        </div>
        <span className="spotlight-index">01 / OCEAN</span>
      </Link>
      <Link to="/integrity" className="network-spotlight cold-spotlight">
        <img src="/cold-chain.png" alt="" loading="lazy" />
        <div>
          <span className="hero-eyebrow">COLD CHAIN ASSURANCE</span>
          <h3>
            Precious cargo.
            <br />
            Precise oversight.
          </h3>
          <p>{cold} loads with temperature constraints</p>
          <span className="spotlight-cta">
            View safety requirements <ArrowUpRight size={17} />
          </span>
        </div>
        <span className="spotlight-index">02 / COLD CHAIN</span>
      </Link>
    </div>
  );
}
