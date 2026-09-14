# Sentinel Flash — Complete Feature List

## Product overview

- Autonomous supply-chain disruption control tower for monitoring shipments and responding to operational problems.
- Uses the workflow **Sense → Simulate → Decide → Commit**.
- Supports both **LIVE mode** for real external data and **DEMO mode** for repeatable hackathon presentations.
- Clearly labels live, demo, unavailable, and unhealthy data sources so simulated information is never presented as real.
- Uses simple operational language throughout the interface so the workflow is easy to explain.

## Live overview dashboard

- Shows the total number of shipments being watched.
- Shows confirmed shipment problems.
- Shows decisions waiting for human review.
- Shows decisions committed automatically.
- Calculates the total cargo value currently at risk.
- Displays live counts for every workflow stage: Sense, Simulate, Decide, and Commit.
- Includes a real-time activity feed showing what the system is doing step by step.
- Shows the latest operational events first, with shipment IDs, workflow stages, timestamps, and explanations.
- Highlights important events such as detected disruptions, policy refusals, approval requests, completed actions, and failures.
- Displays a live system-status bar for the backend, Gemini, news, weather, AIS, ports/database health, and operating mode.
- Includes an operational notification panel for important recent events.

## Interactive global shipment map

- Displays all monitored shipments and their shipping routes on a world map.
- Draws shipment origin, current position, destination, and route line.
- Highlights disrupted routes in red with animated warning styling.
- Shows shipment IDs directly beside their live map positions.
- Makes every ship marker clickable to open that shipment's full details.
- Supports keyboard selection of shipment markers for accessibility.
- Shows the selected shipment's route, risk score, and lane.
- Links map highlighting with the shipment attention list.
- Supports click-and-drag panning.
- Supports continuous left/right world wrapping.
- Supports mouse-wheel zooming.
- Includes dedicated zoom-in, zoom-out, and reset controls.
- Shows the current zoom percentage.
- Includes a working map fullscreen mode.
- Uses a built-in fallback coastline map if the detailed geographic map cannot load.
- Handles routes crossing the international date line without drawing broken lines across the map.

## Shipment management

- Stores and displays eight complete sample shipments across global trade lanes.
- Shows shipment ID, route, cargo, vessel or transport mode, cargo value, ETA, risk score, and status.
- Supports shipment statuses including on track, monitoring, disrupted, pending approval, recovered, and escalated.
- Identifies temperature-controlled shipments with a cold-chain indicator.
- Provides shipment search.
- Provides filtering by shipment status.
- Provides a dedicated details page for every shipment.
- Returns a clear “shipment not found” state for invalid shipment IDs.
- Keeps shipment route, ETA, risk, and status synchronized after a recovery plan is committed.

## Sense — live disruption detection

- Starts a traceable evidence-collection run for a selected shipment.
- Checks news through the GDELT connector.
- Checks origin and destination weather through Open-Meteo.
- Supports vessel-position evidence through AISStream when an API key and live AIS data are available.
- Supports port-congestion evidence through Portcast when credentials are configured.
- Collects news, weather, AIS, and port evidence in parallel.
- Removes duplicate signals before evaluating them.
- Records the source, provider, timestamp, location, confidence, and live/demo status of every signal.
- Correlates independent providers instead of trusting a single weak signal.
- Applies confidence scoring and corroboration bonuses.
- Does not trigger a disruption from one weak source.
- Can confirm a disruption using independent operational evidence.
- Shows why a shipment was flagged, where the issue was found, and how severe it is.
- Safely stops the workflow when no verified disruption is found; no decision or action is created unnecessarily.

## Simulate — recovery option generation

- Generates three recovery strategies for a verified disruption:
  - Reroute the shipment.
  - Re-speed the voyage.
  - Switch the transport mode or transfer point.
- Creates route waypoints for each proposed option.
- Calculates approximate route distance in nautical miles.
- Estimates added delay.
- Calculates voyage fuel from route distance, sailing speed, voyage duration, and a configurable daily fuel baseline.
- Uses the IMO speed-to-power relationship when estimating the extra fuel required by re-speeding.
- Calculates a different cost for every shipment and recovery option.
- Breaks the estimate into bunker fuel, vessel time, port/handling, cargo protection, and risk reserve.
- Uses configurable bunker-price and operating-cost assumptions instead of fixed option prices.
- Estimates remaining operational risk from the shipment's starting risk and the selected recovery strategy.
- Generates a “do nothing” baseline with expected cost, delay, fuel impact, risk, and explanation.
- Visually compares every recovery option against the cost of taking no action.
- Marks every option as viable or refused.
- Shows why each option is recommended, refused, or ranked below another option.

## Decide — AI reasoning and safety rules

- Uses Google Gemini in live mode to generate structured recovery decisions.
- Validates Gemini responses against a strict schema before accepting them.
- Rejects malformed AI output such as missing fields, numeric strings, invalid values, or duplicate option types.
- Uses clearly labeled deterministic logic only for explicit presentation demos.
- Does not silently present deterministic demo output as a live AI decision.
- Saves which decision provider produced the plan.
- Saves the AI's reasoning for the selected plan.
- Saves the reason the chosen option beat the alternatives.
- Applies deterministic safety and governance rules after AI generation, so AI cannot bypass policy.
- Automatically refuses unsafe cold-chain re-speed proposals.
- Requires human approval when added transit time exceeds seven days.
- Requires human approval when additional fuel exceeds 1,000 tonnes.
- Requires human approval when cargo value at risk exceeds $1,000,000.
- Requires human approval for cold-chain shipments.
- Automatically selects another viable option if the AI-recommended option is refused.
- Refuses the complete decision if no viable option remains.
- Clearly displays every triggered policy rule and refusal reason.

## Commit — controlled execution

- Automatically commits safe, lower-risk plans that stay within all approval thresholds.
- Updates the selected route.
- Updates the shipment ETA.
- Updates the shipment risk score.
- Marks a successfully handled shipment as recovered.
- Prevents duplicate execution of the same decision.
- Uses request IDs and idempotency protection so retrying a request does not create duplicate actions or ledger records.
- Creates an operational notification after a successful commit.
- Can send the notification payload to a configured webhook.
- Uses a clearly labeled simulated console notification when no webhook is configured.
- Records whether external notification delivery was real or simulated.

## Human approval and governance

- Provides separate Planner and Approver roles.
- Includes a quick role-switching sign-in screen for demonstrations.
- Sends high-value, high-delay, high-fuel, and cold-chain decisions to the human review queue.
- Shows why each plan needs human review.
- Shows shipment route, cargo value, risk, waiting time, and recommended plan in the approval queue.
- Allows an Approver to approve the recommended plan.
- Allows an Approver to reject and escalate the decision without execution.
- Allows an Approver to override the recommendation with another viable option.
- Provides a review-note field when approving, rejecting, or overriding a plan.
- Prevents a Planner from approving, rejecting, or overriding a decision.
- Prevents an override to an option that has already been refused by policy.
- Shows completed reviews, their outcome, the reviewer, and the applied plan.
- Saves the human actor, action, time, and selected option in the audit record.

## Temperature and cold-chain safety

- Provides a dedicated Temperature Safety workspace.
- Lists every temperature-controlled shipment.
- Displays each shipment's saved temperature and handling constraints.
- Counts protected loads.
- Counts options refused by safety rules.
- Shows how much of the evidence used for a cold-chain decision was live.
- Displays every rejected unsafe recovery option and its reason.
- Enforces cold-chain rules even when a live temperature-sensor feed is not configured.
- Clearly states that the live temperature sensor feed is not connected instead of inventing readings.

## Recovery plans workspace

- Lists every monitored shipment that can be checked.
- Clearly labels each run as live or demo.
- Allows live checks for normal shipments.
- Allows repeatable demo runs for presentation shipments.
- Displays all plans already created.
- Shows each plan's current state, recommended option, cost, delay, risk, number of alternatives, and number of refused options.
- Shows whether the decision came from Gemini, demo logic, or a sense-only result.
- Opens each plan directly in the shipment decision workspace.

## Presentation demos

- Includes three one-click, repeatable presentation scenarios:
  - Automatic decision demo.
  - Safety block demo.
  - Human review demo.
- Uses fixed, clearly labeled demo signals so each walkthrough produces a predictable result.
- Keeps live shipment checks separate from presentation demos.
- Includes a “Clear current view” control to reset presentation results without hiding the difference between live and demo data.
- Demonstrates the full agent workflow in visible stages for judges.

## Decision history and audit ledger

- Maintains a persistent, append-only SQLite decision ledger.
- Provides a read-only Decision History page.
- Lists the timestamp, immutable reference, shipment, lane, decision, status, and actor for every recorded outcome.
- Records autonomous commits, approved commits, overrides, and rejected escalations.
- Prevents ledger entries from being edited or deleted through the interface.
- Stores the complete evidence used for a decision.
- Stores every recovery option that was compared.
- Stores the selected option and its economics.
- Stores the “do nothing” baseline.
- Stores AI or deterministic reasoning.
- Stores all policy rules that were triggered.
- Stores refused options and their exact refusal reasons.
- Stores why the selected option was chosen.
- Stores why alternative options were not selected.
- Stores the human approval or rejection record when applicable.
- Stores notification delivery details.
- Stores the complete step-by-step trace log for the workflow.
- Provides a detailed read-only replay page for every ledger entry.
- Displays the run/trace ID so system events can be connected to the final decision.
- Supports downloading the full ledger as JSON.
- Supports downloading the full ledger as CSV.
- Includes AI reasoning, policy rules, and trace logs in downloaded exports.
- Protects CSV exports against spreadsheet formula injection.

## Real-time system behavior

- Uses Server-Sent Events to stream backend activity to the browser in real time.
- Keeps the activity feed updated without manually refreshing the page.
- Sends a heartbeat on the event stream to keep live connections open.
- Refreshes provider health information automatically.
- Loads shipments, activity, health, workflows, and ledger records from the backend.
- Keeps previously saved decisions after a page reload.
- Keeps the world map visible after a reload, even if the detailed map asset is temporarily unavailable.
- Shows honest provider states such as healthy, configured, ready, unavailable, or offline.
- Provides backend health, AIS status, shipment, workflow, activity, ledger, orchestration, approval, rejection, override, and export API endpoints.

## Interface and usability

- Responsive dashboard layout for desktop and smaller screens.
- Consistent Sentinel Flash branding and custom logo.
- Custom favicon in the browser tab.
- Matching sidebar and page-header alignment.
- Dark and light themes.
- Full-application fullscreen mode.
- Clear visual status badges for live, demo, monitoring, recovered, pending, refused, and error states.
- Smooth page, card, status, workflow, route, alert, and activity animations.
- Respects reduced-motion accessibility preferences.
- Keyboard-accessible map markers and primary controls.
- Accessible labels and tooltips for icon-only buttons.
- Helpful empty states and error messages instead of blank screens.
- Dedicated sign-out control.
- Page titles and descriptions for key routes and social sharing.

## Reliability and testing

- Persists shipments, decisions, actions, requests, activity events, disruptions, and ledger records in SQLite.
- Recovers persistent operational state after backend or page restarts.
- Returns correct not-found errors for unknown shipments and ledger references.
- Uses server-side role checks for protected approval actions.
- Uses timeouts for external provider and webhook calls.
- Tests GDELT, Open-Meteo, and AIS data normalization.
- Tests signal confidence and independent-source correlation.
- Tests strict AI response validation.
- Tests cold-chain refusal rules and all human-approval thresholds.
- Tests the complete Sense → Decide → Policy → Act pipeline.
- Tests duplicate-request and duplicate-ledger protection.
- Tests correct real-time event ordering.
- Tests that all eight shipment routes and demo workflows work without missing-shipment errors.
- Tests Approver approve, reject, and override outcomes.
- Tests JSON and CSV ledger downloads.

## Deployment and operations

- Publicly available at `https://sentinelflash.space`.
- Served over HTTPS.
- Runs the frontend and backend as separate managed services on the VPS.
- Uses Nginx as the public reverse proxy.
- Keeps the SQLite database in persistent storage across deployments.
- Connected to the GitHub repository.
- Automatically checks the connected `master` branch and deploys newly pushed commits.
- Uses release directories and a current-release link for safer application updates.

## Honest limitations and optional integrations

- The sign-in screen uses demo accounts and role selection; it is not a production identity provider.
- AIS requires a working AISStream key and available vessel messages; the interface reports unavailable when no live AIS feed is present.
- Port congestion requires Portcast credentials; it is reported as unavailable when not configured.
- Live temperature sensors are not connected yet; saved cold-chain rules are still enforced.
- Phone or chat notifications require the webhook to be connected to a messaging service such as Telegram, WhatsApp, Slack, or another webhook receiver.
- Review-note entry exists in the interface, but the note is not yet retained reliably after a full backend reload.
- Presentation demo signals are intentionally simulated and visibly labeled as demo data.
