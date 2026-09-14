import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  GitBranch,
  Radar,
  Scale,
  ShieldCheck,
  Ship,
  Sparkles,
  Wind,
} from "lucide-react";

import { WorkspaceIntro } from "@/components/sf/OverviewHero";
import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { Badge, Panel } from "@/components/sf/ui";

export const Route = createFileRoute("/case-studies")({
  component: () => (
    <RequireSession>
      <CaseStudiesPage />
    </RequireSession>
  ),
});

const facts = [
  {
    label: "Canal closure",
    value: "6 days",
    detail: "23–29 March 2021; the vessel was successfully refloated on 29 March.",
    icon: Clock3,
    source: "Suez Canal Authority",
    href: "https://www.suezcanal.gov.eg/English/MediaCenter/News/Pages/nav_29-03-2021.aspx",
  },
  {
    label: "Trade held up",
    value: "$9.6B/day",
    detail: "Value of daily trade delayed—not a claim that this amount was destroyed or lost.",
    icon: CircleDollarSign,
    source: "Lloyd’s List",
    href: "https://www.lloydslist.com/LL1136337/Sometimes-no-publicity-really-is-bad-publicity",
  },
  {
    label: "Carrier loss studied",
    value: "$88.79M",
    detail: "Research estimate for 69 affected Maersk vessels across the East–West network.",
    icon: Ship,
    source: "Peer-reviewed study",
    href: "https://doi.org/10.1016/j.ijpe.2024.109464",
  },
  {
    label: "Inventory cost",
    value: "$76.29M",
    detail:
      "Study estimate for inventory carrying; ship cost was $8.04M and environmental cost $4.46M.",
    icon: Scale,
    source: "Peer-reviewed study",
    href: "https://doi.org/10.1016/j.ijpe.2024.109464",
  },
] as const;

const workflow = [
  {
    number: "01",
    name: "Sense",
    icon: Radar,
    tone: "text-info bg-info-surface border-info/25",
    action: "Load the real record",
    detail:
      "Use the documented 23–29 March closure, SCA refloating notice, published queue count, and reconstructed carrier voyage data.",
    output: "422 queued vessels; 69-vessel Maersk study sample",
  },
  {
    number: "02",
    name: "Simulate",
    icon: GitBranch,
    tone: "text-primary bg-success-surface border-success/25",
    action: "Compare recorded paths",
    detail:
      "Separate the 57 delayed Maersk vessels from the 12 that actually rerouted via the Cape and load the study’s cost results.",
    output: "Observed delay and reroute cohorts with published impacts",
  },
  {
    number: "03",
    name: "Decide",
    icon: ShieldCheck,
    tone: "text-warning bg-warning-surface border-warning/30",
    action: "Reproduce the decision",
    detail:
      "For Magleby Maersk, reproduce the documented Cape reroute and explain the distance, time, fuel, and avoided canal fee behind it.",
    output: "Reroute selected; unsupported alternatives marked unavailable",
  },
  {
    number: "04",
    name: "Commit",
    icon: CheckCircle2,
    tone: "text-success bg-success-surface border-success/25",
    action: "Save the replay",
    detail:
      "Present the observed action as a historical replay and retain direct links to the study and authority records used as evidence.",
    output: "Auditable, sourced historical decision reconstruction",
  },
] as const;

function CaseStudiesPage() {
  return (
    <AppShell title="Case studies" subtitle="Past disruptions, replayed through Sentinel Flash">
      <div className="case-study-page space-y-5 p-4 sm:p-5 lg:p-6">
        <WorkspaceIntro
          eyebrow="THE SENTINEL FIELD NOTES"
          title="Real disruptions. Lasting lessons."
          description="Explore the evidence, understand the trade-offs, and follow the decisions that shaped global supply chains."
        />
        <nav className="case-section-nav" aria-label="Case study sections">
          <a href="#incident-overview">
            01 <span>Incident overview</span>
          </a>
          <a href="#historical-replay">
            02 <span>Historical replay</span>
          </a>
          <a href="#sentinel-workflow">
            03 <span>Sentinel workflow</span>
          </a>
          <a href="#research-basis">
            04 <span>Research & sources</span>
          </a>
        </nav>
        <section
          id="incident-overview"
          className="case-editorial panel relative overflow-hidden p-5 sm:p-6 lg:p-8"
        >
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-warning/10 blur-3xl" />
          <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)] xl:items-end">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone="warning">Historical case</Badge>
                <Badge tone="neutral" dot={false}>
                  March 2021
                </Badge>
                <Badge tone="neutral" dot={false}>
                  Asia → Europe
                </Badge>
              </div>
              <div className="flex items-start gap-4">
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-warning/25 bg-warning-surface text-warning sm:flex">
                  <Ship className="h-6 w-6" />
                </div>
                <div>
                  <p className="label-xs mb-1">Ever Given · Suez Canal</p>
                  <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
                    Six days that disrupted global trade.
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                    The Ever Given container ship became lodged across the canal during high winds
                    and a sandstorm, blocking one of the world’s most important shipping corridors.
                    The case shows why early verification, route-level cost comparison, safety
                    rules, and a complete decision record matter.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/25 bg-success-surface/60 p-4">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Research-data replay
                </span>
              </div>
              <p className="mt-2 text-sm leading-5">
                Replay the incident with actual voyage observations and the peer-reviewed
                carrier-impact study. Unknown option prices stay unavailable instead of being
                invented.
              </p>
              <a
                href="#historical-replay"
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Open historical replay <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <div className="incident-timeline" aria-label="Incident timeline">
          <div>
            <span className="timeline-node" />
            <p>23 MAR 2021</p>
            <strong>Canal blocked</strong>
            <span>Ever Given grounds in the Suez Canal</span>
          </div>
          <div>
            <span className="timeline-node" />
            <p>29 MAR 2021</p>
            <strong>Vessel refloated</strong>
            <span>Canal passage reopens</span>
          </div>
          <div>
            <span className="timeline-node" />
            <p>08 APR 2021</p>
            <strong>Traffic normalizes</strong>
            <span>As reported in the carrier study</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {facts.map(({ label, value, detail, icon: Icon, source, href }) => (
            <div key={label} className="metric-card panel p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="label-xs">{label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="num mt-4 text-2xl font-semibold tracking-tight">{value}</p>
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{detail}</p>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline"
              >
                Source: {source} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>

        <section className="panel grid overflow-hidden lg:grid-cols-[220px_1fr]">
          <div className="border-b border-border bg-warning-surface/55 p-5 lg:border-b-0 lg:border-r">
            <p className="label-xs text-warning">Documented aftermath</p>
            <p className="num mt-3 text-2xl font-semibold">$916M → $550M</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Compensation demanded, then reduced during negotiations
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">Compensation dispute</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The Suez Canal Authority states that its maximum claim was $916 million and that it
                later reduced the requested compensation to $550 million. The final settlement
                amount was not publicly disclosed.
              </p>
              <a
                href="https://www.suezcanal.gov.eg/Arabic/MediaCenter/News/Pages/30-5-2021.aspx"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline"
              >
                Source: Suez Canal Authority <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div>
              <p className="text-sm font-semibold">Vessel detained after refloating</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The vessel remained held in Egypt for more than three months while the financial
                dispute was negotiated. It was released after the parties reached a settlement.
              </p>
              <a
                href="https://apnews.com/article/e464615cbec0641e7ef4b8c9a721ac54"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline"
              >
                Source: Associated Press <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        <Panel
          title="Historical replay · Maersk fleet response"
          subtitle="Observed March–April 2021 voyage data; amounts are published research estimates, not Sentinel-generated prices"
          className="scroll-mt-4"
          bodyClassName="p-4 sm:p-5"
        >
          <div id="historical-replay" className="space-y-5">
            <div className="flex flex-col gap-3 rounded-lg border border-success/30 bg-success-surface/45 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="success">Verified dataset</Badge>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    No fictional shipment
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  The replay uses the published fleet analysis built from ship specifications,
                  Maersk voyage schedules, arrival/departure observations, nautical distances, and
                  AIS-related voyage reconstruction.
                </p>
              </div>
              <a
                href="https://backoffice.biblio.ugent.be/download/01JNDNPNG96R6D7FVB20KKWZM3/01JNDNXQCDYY6EMFSH7SY492DQ"
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Open full study <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "Sense",
                  "422 vessels queued",
                  "SCA figure reported by the study; normal traffic returned on 8 April.",
                ],
                [
                  "Fleet affected",
                  "69 Maersk vessels",
                  "57 delayed at or after the canal; 12 diverted via the Cape.",
                ],
                [
                  "Cargo exposed",
                  "$26.5B",
                  "Published estimate of goods aboard the 69-vessel Maersk sample.",
                ],
                [
                  "Recorded loss",
                  "$88.79M",
                  "$8.04M ship + $4.46M environmental + $76.29M inventory.",
                ],
              ].map(([label, value, detail]) => (
                <div key={label} className="rounded-lg border border-border bg-surface-muted p-4">
                  <p className="label-xs">{label}</p>
                  <p className="num mt-2 text-xl font-semibold">{value}</p>
                  <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="label-xs">Simulate · documented response paths</p>
                  <h3 className="mt-1 text-base font-semibold">
                    Compare what carriers actually did
                  </h3>
                </div>
                <Badge tone="info" dot={false}>
                  Published results
                </Badge>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <article className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">Wait for canal / backlog</p>
                    <Badge tone="neutral">57 vessels</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-surface-muted p-2.5">
                      <p className="text-muted-foreground">Ship cost</p>
                      <p className="num mt-1 font-semibold">$6.84M</p>
                    </div>
                    <div className="rounded bg-surface-muted p-2.5">
                      <p className="text-muted-foreground">Inventory cost</p>
                      <p className="num mt-1 font-semibold">$51.70M</p>
                    </div>
                    <div className="rounded bg-surface-muted p-2.5">
                      <p className="text-muted-foreground">Environmental cost</p>
                      <p className="num mt-1 font-semibold">$0.75M</p>
                    </div>
                    <div className="rounded bg-surface-muted p-2.5">
                      <p className="text-muted-foreground">Anchorage fuel</p>
                      <p className="num mt-1 font-semibold">≈2,400 t</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
                    The study recorded 7,474 tonnes of CO₂ and about $22B of cargo aboard the
                    delayed group.
                  </p>
                </article>

                <article className="rounded-lg border border-primary/35 bg-success-surface/25 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">Reroute via Cape of Good Hope</p>
                    <Badge tone="success">12 vessels</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-surface-muted p-2.5">
                      <p className="text-muted-foreground">Net ship-cost increase</p>
                      <p className="num mt-1 font-semibold">$1.20M</p>
                    </div>
                    <div className="rounded bg-surface-muted p-2.5">
                      <p className="text-muted-foreground">Inventory cost</p>
                      <p className="num mt-1 font-semibold">$24.56M</p>
                    </div>
                    <div className="rounded bg-surface-muted p-2.5">
                      <p className="text-muted-foreground">Environmental cost</p>
                      <p className="num mt-1 font-semibold">$3.51M</p>
                    </div>
                    <div className="rounded bg-surface-muted p-2.5">
                      <p className="text-muted-foreground">Extra fuel</p>
                      <p className="num mt-1 font-semibold">11,914 t</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
                    The group added 33,845 nautical miles and nearly 80 aggregate sailing days,
                    while avoiding $5.86M in canal fees.
                  </p>
                </article>
              </div>
            </div>

            <div className="rounded-xl border border-primary/35 bg-info-surface/45 p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="label-xs text-primary">Decide · real vessel example</p>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">
                    Magleby Maersk → reroute via the Cape
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    This reproduces the vessel’s documented action. The study found that Cape
                    routing could be cheaper on some voyages after avoided Suez tolls, although
                    inventory and environmental costs still increased.
                  </p>
                </div>
                <Badge tone="success" dot={false}>
                  Observed action · committed
                </Badge>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Capacity", "18,340 TEU"],
                  ["Cape route", "10,783 nm · 572 h"],
                  ["Cape fuel", "4,598 t"],
                  ["Suez baseline", "7,034 nm · 373 h · 2,999 t"],
                  ["Avoided canal fee", "$0.80M"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="num mt-1 text-xs font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface-muted p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Re-speed price
                  </p>
                  <p className="mt-1 text-xs font-semibold">Not published for this incident</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-muted p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Port / mode switch price
                  </p>
                  <p className="mt-1 text-xs font-semibold">Not published for this incident</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-surface/45 p-3">
              <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-[11px] leading-5 text-muted-foreground">
                Accuracy note: these costs are the peer-reviewed study’s estimates from actual
                voyage and fleet data—not audited carrier invoices. The public record does not
                contain exact counterfactual prices for every possible choice, so Sentinel displays
                “not published” for those choices rather than guessing.
              </p>
            </div>
          </div>
        </Panel>

        <div id="sentinel-workflow" className="case-section-anchor" />
        <Panel
          title="How Sentinel processes the historical record"
          subtitle="The real event and observed carrier responses mapped into Sense → Simulate → Decide → Commit"
        >
          <div className="grid gap-px bg-border lg:grid-cols-4">
            {workflow.map(({ number, name, icon: Icon, tone, action, detail, output }) => (
              <article key={name} className="workflow-step bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${tone}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="num text-xs text-muted-foreground">{number}</span>
                </div>
                <p className="mt-5 label-xs">{name}</p>
                <h3 className="mt-1 text-base font-semibold">{action}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
                <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    System output
                  </p>
                  <p className="mt-1 text-[11px] leading-4">{output}</p>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <div id="research-basis" className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Panel
            title="Why this case matters"
            subtitle="Published research shows the loss was not only extra sailing fuel"
          >
            <div className="space-y-4 p-5 text-sm leading-6 text-muted-foreground">
              <div
                className="research-cost-chart"
                role="img"
                aria-label="Published study loss breakdown: inventory 76.29 million dollars, ship costs 8.04 million, environmental costs 4.46 million."
              >
                <div className="research-cost-bar">
                  <span style={{ flex: 76.29 }} />
                  <span style={{ flex: 8.04 }} />
                  <span style={{ flex: 4.46 }} />
                </div>
                <div className="research-cost-legend">
                  <span>
                    Inventory <strong>$76.29M</strong>
                  </span>
                  <span>
                    Ship <strong>$8.04M</strong>
                  </span>
                  <span>
                    Environmental <strong>$4.46M</strong>
                  </span>
                </div>
              </div>
              <p>
                The peer-reviewed carrier study estimated{" "}
                <span className="font-semibold text-foreground">$88.79 million</span>
                in total losses:{" "}
                <span className="font-semibold text-foreground">
                  $76.29 million inventory carrying
                </span>
                ,<span className="font-semibold text-foreground"> $8.04 million ship cost</span>,
                and
                <span className="font-semibold text-foreground">
                  {" "}
                  $4.46 million environmental cost
                </span>{" "}
                across 69 affected Maersk vessels.
              </p>
              <p>
                Sentinel Flash therefore compares fuel and vessel time alongside cargo exposure,
                handling, protection, delay, and risk. This prevents an apparently cheap “wait”
                decision from hiding a much larger business cost.
              </p>
            </div>
          </Panel>

          <Panel
            title="Research basis"
            subtitle="Every historical number on this page links to its source"
          >
            <div className="space-y-3 p-5">
              <div className="flex gap-3 rounded-lg border border-border bg-surface-muted p-3">
                <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Historical figures describe the real incident. Sentinel’s response is a
                  retrospective workflow reconstruction; it does not claim that Sentinel operated in
                  2021 or that it would have prevented the grounding.
                </p>
              </div>
              <div className="flex gap-3 rounded-lg border border-border bg-surface-muted p-3">
                <Wind className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Historical financial results are kept separate from Sentinel’s planning estimates.
                  The page does not invent a savings figure or present the $9.6B daily trade flow as
                  an economic loss.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <a
                  href="https://www.sciencedirect.com/science/article/pii/S0925527324003219"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/50"
                >
                  Carrier cost study <ExternalLink className="h-3 w-3 text-primary" />
                </a>
                <a
                  href="https://www.gu.se/nyheter/sa-mycket-kostade-stoppet-i-suez-kanalen"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/50"
                >
                  University summary <ExternalLink className="h-3 w-3 text-primary" />
                </a>
                <a
                  href="https://www.suezcanal.gov.eg/Arabic/MediaCenter/News/Pages/30-5-2021.aspx"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/50"
                >
                  $916M → $550M claims <ExternalLink className="h-3 w-3 text-primary" />
                </a>
                <a
                  href="https://www.lloydslist.com/LL1136337/Sometimes-no-publicity-really-is-bad-publicity"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/50"
                >
                  $9.6B daily trade flow <ExternalLink className="h-3 w-3 text-primary" />
                </a>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
