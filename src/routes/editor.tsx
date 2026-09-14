import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  FileSpreadsheet,
  MessageSquareText,
  PackagePlus,
  PencilLine,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { AppShell } from "@/components/sf/AppShell";
import { RequireSession } from "@/components/sf/guard";
import { Badge, Button, EmptyState, Panel } from "@/components/sf/ui";
import { dateTime, usdExact } from "@/lib/sf/format";
import { useSentinel } from "@/lib/sf/store";
import type { ShipmentDraft } from "@/lib/sf/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "Shipment Editor — Sentinel Flash" },
      {
        name: "description",
        content: "Add, import, validate and remove shipments from the Sentinel Flash network.",
      },
    ],
  }),
  component: () => (
    <RequireSession>
      <EditorPage />
    </RequireSession>
  ),
});

const PORTS = [
  ["BEANR", "Antwerp"],
  ["KRPUS", "Busan"],
  ["INMAA", "Chennai"],
  ["ZADUR", "Durban"],
  ["GBFXT", "Felixstowe"],
  ["DEHAM", "Hamburg"],
  ["AEJEA", "Jebel Ali"],
  ["USLAX", "Los Angeles"],
  ["KEMBA", "Mombasa"],
  ["USNYC", "New York"],
  ["CNNGB", "Ningbo"],
  ["NLRTM", "Rotterdam"],
  ["BRSSZ", "Santos"],
  ["USSEA", "Seattle"],
  ["CNSHA", "Shanghai"],
  ["SGSIN", "Singapore"],
  ["ESVLC", "Valencia"],
] as const;

type EntryMode = "guided" | "chat" | "file";
type FormState = Omit<
  ShipmentDraft,
  "quantity" | "cargoValueUsd" | "temperatureMinC" | "temperatureMaxC" | "constraints"
> & {
  quantity: string;
  cargoValueUsd: string;
  coldChain: boolean;
  temperatureMinC: string;
  temperatureMaxC: string;
  constraints: string;
};

const initialForm = (): FormState => ({
  id: "",
  originCode: "CNNGB",
  destinationCode: "NLRTM",
  cargo: "",
  cargoCategory: "electronics",
  quantity: "",
  quantityUnit: "units",
  cargoValueUsd: "",
  mode: "ocean",
  vessel: "",
  etaIso: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 16),
  coldChain: false,
  temperatureMinC: "2",
  temperatureMaxC: "8",
  priority: "standard",
  reference: "",
  owner: "",
  notes: "",
  constraints: "",
});

const fieldClass =
  "h-10 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";
const labelClass = "space-y-1.5 text-xs font-semibold text-foreground";

function EditorPage() {
  const { state, createShipment, deleteShipment, parseShipment } = useSentinel();
  const [mode, setMode] = useState<EntryMode>("guided");
  const [form, setForm] = useState<FormState>(initialForm);
  const [draft, setDraft] = useState<ShipmentDraft | null>(null);
  const [draftSource, setDraftSource] = useState<EntryMode>("guided");
  const [chat, setChat] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const editorShipments = useMemo(
    () =>
      [...state.shipments].sort((a, b) =>
        (b.createdAtIso ?? "").localeCompare(a.createdAtIso ?? ""),
      ),
    [state.shipments],
  );

  if (state.user?.role !== "editor") {
    return (
      <AppShell title="Shipment editor" subtitle="Editor access is required">
        <div className="p-6">
          <Panel>
            <EmptyState
              title="This workspace is for shipment editors"
              description="Sign out and choose the Editor role to add, import, or remove shipment records."
            />
          </Panel>
        </div>
      </AppShell>
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const formToDraft = (): ShipmentDraft => ({
    id: form.id || undefined,
    originCode: form.originCode,
    destinationCode: form.destinationCode,
    cargo: form.cargo,
    cargoCategory: form.cargoCategory,
    quantity: Number(form.quantity),
    quantityUnit: form.quantityUnit,
    cargoValueUsd: Number(form.cargoValueUsd),
    mode: form.mode,
    vessel: form.vessel,
    etaIso: new Date(form.etaIso).toISOString(),
    temperatureMinC: form.coldChain ? Number(form.temperatureMinC) : null,
    temperatureMaxC: form.coldChain ? Number(form.temperatureMaxC) : null,
    priority: form.priority,
    reference: form.reference,
    owner: form.owner,
    notes: form.notes,
    constraints: form.constraints
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  });

  const loadDraftIntoForm = (value: ShipmentDraft) => {
    setForm({
      ...initialForm(),
      ...value,
      id: value.id ?? "",
      quantity: String(value.quantity),
      cargoValueUsd: String(value.cargoValueUsd),
      etaIso: new Date(value.etaIso).toISOString().slice(0, 16),
      coldChain: value.temperatureMinC != null || value.temperatureMaxC != null,
      temperatureMinC: value.temperatureMinC == null ? "2" : String(value.temperatureMinC),
      temperatureMaxC: value.temperatureMaxC == null ? "8" : String(value.temperatureMaxC),
      constraints: value.constraints.join("\n"),
    });
    setDraft(null);
    setMode("guided");
  };

  const extract = async (text: string, source: "chat" | "file") => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await parseShipment(text);
      setDraft(result.draft);
      setDraftSource(source);
      setMessage(
        `Gemini structured the ${source === "file" ? "file" : "message"}. Review it before saving.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not extract shipment details");
    } finally {
      setBusy(false);
    }
  };

  const submitGuided = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      setDraft(formToDraft());
      setDraftSource("guided");
      setMessage("Details are ready. Check the summary before adding the shipment.");
    } catch {
      setError("Check the ETA and numeric values, then try again.");
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const shipment = await createShipment(draft, draftSource);
      setDraft(null);
      setForm(initialForm());
      setChat("");
      setFileName("");
      setMessage(`${shipment.id} was added to the live dashboard and network map.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save shipment");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (
      !window.confirm(
        `Remove ${id} from the active shipment register? Existing ledger records remain saved.`,
      )
    )
      return;
    setRemoving(id);
    setError(null);
    try {
      await deleteShipment(id);
      setMessage(`${id} was removed from the dashboard and map.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove shipment");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <AppShell
      title="Shipment editor"
      subtitle="Create clean shipment records and keep the live network current"
      actions={<Badge tone="info">Editor access</Badge>}
    >
      <div className="space-y-5 p-4 sm:p-5 lg:p-6">
        <section className="editor-hero">
          <div>
            <p className="label-xs text-primary">SHIPMENT DATA STUDIO</p>
            <h2>Three ways in. One trusted shipment record.</h2>
            <p>
              Enter details step by step, paste an unstructured message, or upload a data file.
              Every method creates a reviewable draft before anything reaches operations.
            </p>
          </div>
          <div className="editor-hero-stat">
            <span className="num">{state.shipments.length}</span>
            <small>active shipments</small>
          </div>
        </section>

        <div
          className="grid gap-3 md:grid-cols-3"
          role="tablist"
          aria-label="Shipment entry method"
        >
          {(
            [
              ["guided", PencilLine, "Guided entry", "Choose each field with clear options"],
              [
                "chat",
                MessageSquareText,
                "Paste & structure",
                "Gemini turns a message into fields",
              ],
              ["file", FileSpreadsheet, "Import a file", "Extract from TXT, CSV, JSON or Markdown"],
            ] as const
          ).map(([key, Icon, title, note]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => {
                setMode(key);
                setDraft(null);
                setError(null);
              }}
              className={cn("entry-method-card", mode === key && "is-active")}
            >
              <span className="entry-method-icon">
                <Icon size={18} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{note}</small>
              </span>
              {mode === key && <CheckCircle2 className="ml-auto text-primary" size={18} />}
            </button>
          ))}
        </div>

        {message && (
          <div className="rounded-xl border border-success/25 bg-success-surface px-4 py-3 text-sm text-success">
            {message}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger-surface px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel
            title={
              mode === "guided"
                ? "Shipment details"
                : mode === "chat"
                  ? "Paste shipment information"
                  : "Upload shipment file"
            }
            subtitle={
              mode === "guided"
                ? "Required fields are marked with *"
                : "Gemini extracts only the information present, then asks you to review it"
            }
            bodyClassName="p-5"
          >
            {mode === "guided" && (
              <form onSubmit={submitGuided} className="space-y-6">
                <FormSection
                  title="Route and identity"
                  note="Where it is going and how it can be identified"
                >
                  <Field label="Shipment ID (optional)">
                    <input
                      className={fieldClass}
                      value={form.id}
                      onChange={(e) => update("id", e.target.value)}
                      placeholder="Generated automatically"
                    />
                  </Field>
                  <Field label="Origin *">
                    <PortSelect
                      value={form.originCode}
                      onChange={(value) => update("originCode", value)}
                    />
                  </Field>
                  <Field label="Destination *">
                    <PortSelect
                      value={form.destinationCode}
                      onChange={(value) => update("destinationCode", value)}
                    />
                  </Field>
                  <Field label="Mode *">
                    <Choice
                      value={form.mode}
                      options={["ocean", "air", "rail"]}
                      onChange={(value) => update("mode", value as FormState["mode"])}
                    />
                  </Field>
                  <Field label="Vessel / flight / train *">
                    <input
                      required
                      className={fieldClass}
                      value={form.vessel}
                      onChange={(e) => update("vessel", e.target.value)}
                      placeholder="e.g. MV Horizon"
                    />
                  </Field>
                  <Field label="ETA *">
                    <input
                      required
                      type="datetime-local"
                      className={fieldClass}
                      value={form.etaIso}
                      onChange={(e) => update("etaIso", e.target.value)}
                    />
                  </Field>
                </FormSection>

                <FormSection
                  title="Cargo and value"
                  note="What is moving, how much, and its declared value"
                >
                  <Field label="Cargo category *">
                    <select
                      className={fieldClass}
                      value={form.cargoCategory}
                      onChange={(e) =>
                        update("cargoCategory", e.target.value as FormState["cargoCategory"])
                      }
                    >
                      {[
                        "medicine",
                        "electronics",
                        "food",
                        "chemicals",
                        "automotive",
                        "textiles",
                        "machinery",
                        "other",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cargo description *">
                    <input
                      required
                      className={fieldClass}
                      value={form.cargo}
                      onChange={(e) => update("cargo", e.target.value)}
                      placeholder="e.g. Insulin pens"
                    />
                  </Field>
                  <Field label="Quantity *">
                    <input
                      required
                      min="0.000001"
                      step="any"
                      type="number"
                      className={fieldClass}
                      value={form.quantity}
                      onChange={(e) => update("quantity", e.target.value)}
                    />
                  </Field>
                  <Field label="Quantity unit *">
                    <select
                      className={fieldClass}
                      value={form.quantityUnit}
                      onChange={(e) =>
                        update("quantityUnit", e.target.value as FormState["quantityUnit"])
                      }
                    >
                      {["units", "kg", "tonnes", "pallets", "containers", "litres"].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cargo value (USD) *">
                    <input
                      required
                      min="0.01"
                      step="0.01"
                      type="number"
                      className={fieldClass}
                      value={form.cargoValueUsd}
                      onChange={(e) => update("cargoValueUsd", e.target.value)}
                      placeholder="620000"
                    />
                  </Field>
                  <Field label="Priority *">
                    <Choice
                      value={form.priority}
                      options={["standard", "high", "critical"]}
                      onChange={(value) => update("priority", value as FormState["priority"])}
                    />
                  </Field>
                </FormSection>

                <FormSection
                  title="Safety and ownership"
                  note="Temperature rules, handling limits and internal references"
                >
                  <Field label="Temperature controlled? *">
                    <Choice
                      value={form.coldChain ? "yes" : "no"}
                      options={["no", "yes"]}
                      onChange={(value) => update("coldChain", value === "yes")}
                    />
                  </Field>
                  {form.coldChain && (
                    <>
                      <Field label="Minimum °C *">
                        <input
                          required
                          type="number"
                          step="any"
                          className={fieldClass}
                          value={form.temperatureMinC}
                          onChange={(e) => update("temperatureMinC", e.target.value)}
                        />
                      </Field>
                      <Field label="Maximum °C *">
                        <input
                          required
                          type="number"
                          step="any"
                          className={fieldClass}
                          value={form.temperatureMaxC}
                          onChange={(e) => update("temperatureMaxC", e.target.value)}
                        />
                      </Field>
                    </>
                  )}
                  <Field label="Owner / customer">
                    <input
                      className={fieldClass}
                      value={form.owner}
                      onChange={(e) => update("owner", e.target.value)}
                    />
                  </Field>
                  <Field label="Booking reference">
                    <input
                      className={fieldClass}
                      value={form.reference}
                      onChange={(e) => update("reference", e.target.value)}
                    />
                  </Field>
                  <Field label="Handling constraints" wide>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-input bg-surface p-3 text-sm outline-none focus:border-primary"
                      value={form.constraints}
                      onChange={(e) => update("constraints", e.target.value)}
                      placeholder="One rule per line"
                    />
                  </Field>
                  <Field label="Notes" wide>
                    <textarea
                      className="min-h-20 w-full rounded-xl border border-input bg-surface p-3 text-sm outline-none focus:border-primary"
                      value={form.notes}
                      onChange={(e) => update("notes", e.target.value)}
                    />
                  </Field>
                </FormSection>
                <div className="flex justify-end">
                  <Button type="submit">
                    <PackagePlus size={16} /> Review shipment
                  </Button>
                </div>
              </form>
            )}

            {mode === "chat" && (
              <div className="space-y-4">
                <div className="ai-entry-box">
                  <Sparkles size={18} />
                  <div>
                    <strong>Describe it naturally</strong>
                    <p>
                      Include route, cargo, quantity, value, transport, ETA, temperature and any
                      handling rules.
                    </p>
                  </div>
                </div>
                <textarea
                  aria-label="Shipment message"
                  className="min-h-64 w-full rounded-2xl border border-input bg-surface p-4 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  placeholder="Example: Shipment BK-482 leaves Antwerp for Mombasa by ocean on MV Horizon. It carries 18 pallets of vaccines worth $620,000, must stay between 2 and 8°C, ETA 24 September 2026 at 06:00 UTC…"
                />
                <div className="flex justify-end">
                  <Button
                    disabled={busy || chat.trim().length < 20}
                    onClick={() => extract(chat, "chat")}
                  >
                    <Sparkles size={16} /> {busy ? "Structuring…" : "Structure with Gemini"}
                  </Button>
                </div>
              </div>
            )}

            {mode === "file" && (
              <div className="space-y-4">
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  accept=".txt,.csv,.json,.md,text/plain,text/csv,application/json"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setFileName(file.name);
                    if (file.size > 120_000) {
                      setError("File is too large. Use a text-based file under 120 KB.");
                      return;
                    }
                    await extract(await file.text(), "file");
                  }}
                />
                <button
                  type="button"
                  className="file-drop-zone"
                  onClick={() => fileInput.current?.click()}
                >
                  <span className="file-drop-icon">
                    <UploadCloud size={26} />
                  </span>
                  <strong>{fileName || "Choose a shipment file"}</strong>
                  <span>
                    {busy
                      ? "Reading and structuring…"
                      : "TXT, CSV, JSON or Markdown · maximum 120 KB"}
                  </span>
                </button>
                <div className="rounded-xl bg-surface-muted p-4 text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Tip:</strong> One shipment per file works
                  best. Include cargo, quantity, declared value, origin, destination, ETA, transport
                  asset and temperature limits.
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Structured draft"
            subtitle="Nothing is saved until you confirm"
            bodyClassName="p-5"
          >
            {draft ? (
              <DraftSummary
                draft={draft}
                onEdit={() => loadDraftIntoForm(draft)}
                onSave={saveDraft}
                busy={busy}
              />
            ) : (
              <EmptyState
                title="No draft yet"
                description="Complete the selected entry method to build a shipment preview here."
              />
            )}
          </Panel>
        </div>

        <Panel
          title="Active shipment register"
          subtitle="New records appear on the dashboard and map immediately"
          bodyClassName="overflow-x-auto"
        >
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                {[
                  "Shipment",
                  "Route",
                  "Cargo",
                  "Quantity",
                  "Temperature",
                  "Value",
                  "ETA",
                  "Added by",
                  "",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-semibold tracking-wide uppercase">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {editorShipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td className="num px-4 py-3 font-semibold">
                    <Link
                      to="/shipment/$id"
                      params={{ id: shipment.id }}
                      className="hover:text-primary"
                    >
                      {shipment.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {shipment.origin.name} → {shipment.destination.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{shipment.cargo}</span>
                    <small className="block capitalize text-muted-foreground">
                      {shipment.cargoCategory ?? "not classified"}
                    </small>
                  </td>
                  <td className="num px-4 py-3">
                    {shipment.quantity
                      ? `${shipment.quantity.toLocaleString()} ${shipment.quantityUnit}`
                      : "—"}
                  </td>
                  <td className="num px-4 py-3">
                    {shipment.coldChain
                      ? `${shipment.temperatureMinC ?? "?"}–${shipment.temperatureMaxC ?? "?"} °C`
                      : "Ambient"}
                  </td>
                  <td className="num px-4 py-3">{usdExact(shipment.cargoValueUsd)}</td>
                  <td className="num px-4 py-3">{dateTime(shipment.etaIso)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {shipment.createdBy ?? "Seed data"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={removing === shipment.id}
                      onClick={() => remove(shipment.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 px-2.5 py-1.5 font-semibold text-danger hover:bg-danger-surface disabled:opacity-50"
                    >
                      <Trash2 size={13} /> {removing === shipment.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </AppShell>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={cn(labelClass, wide && "md:col-span-2 xl:col-span-3")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function FormSection({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <div>
        <legend className="text-sm font-semibold">{title}</legend>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function PortSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
      {PORTS.map(([code, name]) => (
        <option key={code} value={code}>
          {name} · {code}
        </option>
      ))}
    </select>
  );
}

function Choice({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-h-10 flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-lg border px-3 py-2 text-xs font-semibold capitalize",
            value === option
              ? "border-primary bg-accent text-primary"
              : "border-border bg-surface text-muted-foreground hover:bg-accent/50",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function DraftSummary({
  draft,
  onEdit,
  onSave,
  busy,
}: {
  draft: ShipmentDraft;
  onEdit: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  const port = (code: string) => PORTS.find(([candidate]) => candidate === code)?.[1] ?? code;
  const items = [
    ["Route", `${port(draft.originCode)} → ${port(draft.destinationCode)}`],
    ["Cargo", `${draft.cargo} · ${draft.cargoCategory}`],
    ["Quantity", `${draft.quantity.toLocaleString()} ${draft.quantityUnit}`],
    ["Declared value", usdExact(draft.cargoValueUsd)],
    ["Transport", `${draft.mode} · ${draft.vessel}`],
    ["ETA", dateTime(draft.etaIso)],
    [
      "Temperature",
      draft.temperatureMinC != null || draft.temperatureMaxC != null
        ? `${draft.temperatureMinC ?? "?"}–${draft.temperatureMaxC ?? "?"} °C`
        : "Ambient",
    ],
    ["Priority", draft.priority],
    ["Owner", draft.owner || "Not supplied"],
    ["Reference", draft.reference || "Not supplied"],
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl bg-success-surface p-3 text-xs font-semibold text-success">
        <CheckCircle2 size={16} /> Ready for human review
      </div>
      <dl className="divide-y divide-border rounded-xl border border-border">
        {items.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[110px_1fr] gap-3 px-3 py-2.5">
            <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {label}
            </dt>
            <dd className="break-words text-xs font-medium capitalize">{value}</dd>
          </div>
        ))}
      </dl>
      {draft.constraints.length > 0 && (
        <div>
          <p className="label-xs mb-2">Constraints</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {draft.constraints.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onEdit}>
          <PencilLine size={14} /> Edit fields
        </Button>
        <Button disabled={busy} onClick={onSave}>
          <PackagePlus size={14} /> {busy ? "Adding…" : "Add shipment"}
        </Button>
      </div>
    </div>
  );
}
