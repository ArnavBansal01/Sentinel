# Sentinel Flash 🌐⚡
### Autonomous Supply-Chain Disruption Control Tower

**Sentinel Flash** is an autonomous disruption control tower designed to sense verified multi-source signals, evaluate recovery options against the true cost of inaction, enforce hard operational constraints, and commit recovery decisions safely—with full human oversight and an immutable decision ledger.

---

## ⚡ Core Paradigm: Sense · Decide · Act

```
[ Signals & AIS Feed ]  ──►  ( 1. SENSE )
                                   │
                                   ▼
[ Gemini Reasoning + Fallback ] ──► ( 2. DECIDE ) ──► [ Hard Constraint Validation ]
                                                           │
                                                           ▼
                             ( 3. ACT ) ◄──────────────────┴──────────────────► ( 3. ESCALATE )
                                  │                                                   │
                                  ▼                                                   ▼
                        [ Autonomous Commit ]                               [ Human Approver Queue ]
                                  │                                                   │
                                  └──────────────────────┬────────────────────────────┘
                                                         ▼
                                             [ Immutable Audit Ledger ]
```

### 1. Sense
- **Signal Correlation**: Ingests and correlates disparate event data (port congestion, maritime weather warnings, berth delays, AIS vessel positions).
- **Source Verification**: Distinguishes verified ground-truth alerts from noise before triggering downstream workflows.

### 2. Decide
- **Option Generation**: Evaluates multiple strategic recovery levers for every disruption:
  - **Reroute**: Divert to alternative ports or hinterland transfer hubs.
  - **Re-speed**: Adjust voyage speed knots to meet critical berth windows.
  - **Switch Mode**: Modal shifts (e.g., barge, rail, road feeder) to avoid chokepoints.
- **Cost of Inaction**: Directly benchmarks option economics against the true cost of doing nothing (demurrage, detention, downstream plant stoppage).
- **Constraint Enforcement**: Enforces hard operational guardrails (e.g., strict cold-chain integrity, hazardous material handling, maximum transit delay). Unsafe proposals are automatically refused.

### 3. Act & Govern
- **Autonomous Execution**: Low-to-moderate risk decisions within pre-approved cost and delay thresholds commit autonomously to minimize latency.
- **Human Decision Authority**: High-cargo-value disruptions or regulatory policy breaches automatically pause and escalate to the **Approver Queue** with full decision context.
- **Immutable Ledger**: Every action, human override, and system rationale is committed to an auditable decision ledger for replay and post-mortem analysis.

---

## 🛠️ Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (Full-stack SSR with Vite & Nitro)
- **Routing**: [TanStack Router](https://tanstack.com/router) with typed file-based routes
- **Data & State**: [TanStack Query](https://tanstack.com/query) + Custom Sentinel Reactive Store
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS, Class Variance Authority, Radix UI primitives
- **Icons & Visuals**: Lucide React, Custom SVG Geographic Map & Canvas Visualizations
- **AI Engine**: Google Gemini API (`gemini-2.5-flash` / `gemini-3.8-flash`) with structured schema validation & deterministic rule-based fallbacks

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.18+ or v20+ recommended)
- **npm**, **pnpm**, or **bun**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ArnavBansal01/Sentinel.git
   cd Sentinel
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Add your API keys:
   ```ini
   # Google Gemini API key (server-side only)
   GEMINI_API_KEY=your_gemini_api_key_here

   # Optional: AISStream or Lovable AI Gateway keys
   AISSTREAM_API_KEY=your_aisstream_key_here
   LOVABLE_API_KEY=your_lovable_key_here
   ```
   *(Note: If no API key is provided, the engine seamlessly utilizes deterministic domain-accurate recovery fallbacks.)*

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open the application**:
   Visit [http://localhost:8080](http://localhost:8080) in your browser.

---

## 🧭 Key Workspaces & Routes

| Route | View | Description |
|---|---|---|
| `/login` | **Operator Sign In** | Quick role switcher between **Planner** and **Approver**. |
| `/planner` | **Control Tower** | Real-time map, active disruption metrics, operational activity feed, and shipment exceptions. |
| `/approver` | **Approval Queue** | Governance queue for decisions held above autonomous policy thresholds. |
| `/shipment/$id` | **Shipment Detail** | Detailed 3-stage workspace (Sense evidence, Decide option matrix, Act result) for individual containers. |
| `/ledger` | **Decision Ledger** | Read-only immutable record of all historical and session recovery commits. |
| `/ledger/$entryId` | **Decision Replay** | Full replay reconstruction showing what was known, options considered, and who authorized the outcome. |

---

## 🧪 Available Scripts

- `npm run dev` — Starts the Vite dev server with SSR and hot-reload.
- `npm run build` — Compiles the production application bundle.
- `npm run preview` — Locally preview the production build.
- `npm run lint` — Runs ESLint checks across the codebase.
- `npm run format` — Formats files with Prettier.

---

## 🛡️ License

This project is licensed under the MIT License.
