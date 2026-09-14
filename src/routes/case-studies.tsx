import { createFileRoute, Link } from "@tanstack/react-router";
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
    detail: "Study estimate for inventory carrying; ship cost was $8.04M and environmental cost $4.46M.",
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
    action: "Confirm the blockage",
    detail:
      "Combine canal notices, AIS vessel queues, weather, port congestion, and trusted news. Mark each source as live, historical, or simulated.",
    output: "Verified disruption, location, confidence, affected lanes",
  },
  {
    number: "02",
    name: "Simulate",
    icon: GitBranch,
    tone: "text-primary bg-success-surface border-success/25",
    action: "Compare recovery choices",
    detail:
      "Estimate sailing via the Cape of Good Hope, waiting for reopening, changing port or mode, and prioritising high-value or temperature-sensitive cargo.",
    output: "Time, fuel, handling, cargo exposure, risk, and cost per option",
  },
  {
    number: "03",
    name: "Decide",
    icon: ShieldCheck,
    tone: "text-warning bg-warning-surface border-warning/30",
    action: "Choose safely",
    detail:
      "Rank viable plans against the cost of doing nothing. Block choices that break cold-chain, capacity, compliance, or approval rules.",
    output: "Best safe plan with plain-language reasoning and refusals",
  },
  {
    number: "04",
    name: "Commit",
    icon: CheckCircle2,
    tone: "text-success bg-success-surface border-success/25",
    action: "Apply or request approval",
    detail:
      "Automatically apply low-risk decisions or send high-value decisions to a human. Save the evidence, calculation, actor, and action in the ledger.",
    output: "Auditable action, notifications, approval state, saved reasoning",
  },
] as const;

function CaseStudiesPage() {
  return (
    <AppShell title="Case studies" subtitle="Past disruptions, replayed through Sentinel Flash">
      <div className="space-y-5 p-4 sm:p-5 lg:p-6">
        <section className="panel relative overflow-hidden p-5 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-warning/10 blur-3xl" />
          <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)] xl:items-end">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone="warning">Historical case</Badge>
                <Badge tone="neutral" dot={false}>March 2021</Badge>
                <Badge tone="neutral" dot={false}>Asia → Europe</Badge>
              </div>
              <div className="flex items-start gap-4">
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-warning/25 bg-warning-surface text-warning sm:flex">
                  <Ship className="h-6 w-6" />
                </div>
                <div>
                  <p className="label-xs mb-1">Ever Given · Suez Canal</p>
                  <h2 className="max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
                    What if Sentinel Flash had watched the route?
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                    The Ever Given container ship became lodged across the canal during high winds and a sandstorm,
                    blocking one of the world’s most important shipping corridors. The case shows why early verification,
                    route-level cost comparison, safety rules, and a complete decision record matter.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/25 bg-success-surface/60 p-4">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Fictional workflow demonstration</span>
              </div>
              <p className="mt-2 text-sm leading-5">
                Open a fictional comparable Suez disruption and see the system verify evidence, model alternatives,
                enforce safety, and prepare a decision. Its planning estimates are not 2021 historical costs.
              </p>
              <Link
                to="/shipment/$id"
                params={{ id: "SF-1002" }}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Open fictional scenario <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

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
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Compensation demanded, then reduced during negotiations</p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">Compensation dispute</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The Suez Canal Authority states that its maximum claim was $916 million and that it later reduced the
                requested compensation to $550 million. The final settlement amount was not publicly disclosed.
              </p>
              <a href="https://www.suezcanal.gov.eg/Arabic/MediaCenter/News/Pages/30-5-2021.aspx" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline">
                Source: Suez Canal Authority <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div>
              <p className="text-sm font-semibold">Vessel detained after refloating</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The vessel remained held in Egypt for more than three months while the financial dispute was negotiated.
                It was released after the parties reached a settlement.
              </p>
              <a href="https://apnews.com/article/e464615cbec0641e7ef4b8c9a721ac54" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline">
                Source: Associated Press <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        <Panel
          title="How Sentinel Flash would respond"
          subtitle="A clear reconstruction of the product workflow—not a claim that the system operated in 2021"
        >
          <div className="grid gap-px bg-border lg:grid-cols-4">
            {workflow.map(({ number, name, icon: Icon, tone, action, detail, output }) => (
              <article key={name} className="workflow-step bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="num text-xs text-muted-foreground">{number}</span>
                </div>
                <p className="mt-5 label-xs">{name}</p>
                <h3 className="mt-1 text-base font-semibold">{action}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
                <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">System output</p>
                  <p className="mt-1 text-[11px] leading-4">{output}</p>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Panel title="Why this case matters" subtitle="Published research shows the loss was not only extra sailing fuel">
            <div className="space-y-4 p-5 text-sm leading-6 text-muted-foreground">
              <p>
                The peer-reviewed carrier study estimated <span className="font-semibold text-foreground">$88.79 million</span>
                in total losses: <span className="font-semibold text-foreground">$76.29 million inventory carrying</span>,
                <span className="font-semibold text-foreground"> $8.04 million ship cost</span>, and
                <span className="font-semibold text-foreground"> $4.46 million environmental cost</span> across 69 affected
                Maersk vessels.
              </p>
              <p>
                Sentinel Flash therefore compares fuel and vessel time alongside cargo exposure, handling, protection,
                delay, and risk. This prevents an apparently cheap “wait” decision from hiding a much larger business cost.
              </p>
            </div>
          </Panel>

          <Panel title="Research basis" subtitle="Every historical number on this page links to its source">
            <div className="space-y-3 p-5">
              <div className="flex gap-3 rounded-lg border border-border bg-surface-muted p-3">
                <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Historical figures describe the real incident. Sentinel’s response is a retrospective workflow
                  reconstruction; it does not claim that Sentinel operated in 2021 or that it would have prevented the grounding.
                </p>
              </div>
              <div className="flex gap-3 rounded-lg border border-border bg-surface-muted p-3">
                <Wind className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Historical financial results are kept separate from Sentinel’s planning estimates. The page does not invent
                  a savings figure or present the $9.6B daily trade flow as an economic loss.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <a href="https://www.sciencedirect.com/science/article/pii/S0925527324003219" target="_blank" rel="noreferrer" className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/50">
                  Carrier cost study <ExternalLink className="h-3 w-3 text-primary" />
                </a>
                <a href="https://www.gu.se/nyheter/sa-mycket-kostade-stoppet-i-suez-kanalen" target="_blank" rel="noreferrer" className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/50">
                  University summary <ExternalLink className="h-3 w-3 text-primary" />
                </a>
                <a href="https://www.suezcanal.gov.eg/Arabic/MediaCenter/News/Pages/30-5-2021.aspx" target="_blank" rel="noreferrer" className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/50">
                  $916M → $550M claims <ExternalLink className="h-3 w-3 text-primary" />
                </a>
                <a href="https://www.lloydslist.com/LL1136337/Sometimes-no-publicity-really-is-bad-publicity" target="_blank" rel="noreferrer" className="inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/50">
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
