import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { shipments as seed } from "../shipments/seed.js";
import type {
  ActivityEvent,
  Decision,
  DisruptionAssessment,
  LedgerEntry,
  Shipment,
} from "../types/domain.js";

const file =
  process.env["NODE_ENV"] === "test"
    ? ":memory:"
    : resolve(process.env["SENTINEL_DB_PATH"] ?? "data/sentinel.db");
if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
export const db = new DatabaseSync(file);
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS shipments(id TEXT PRIMARY KEY,json TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS disruptions(id TEXT PRIMARY KEY,shipment_id TEXT NOT NULL,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS decisions(id TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,shipment_id TEXT NOT NULL,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY,decision_id TEXT UNIQUE NOT NULL,shipment_id TEXT NOT NULL,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity(id TEXT PRIMARY KEY,shipment_id TEXT NOT NULL,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,action_id TEXT UNIQUE,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS requests(request_id TEXT PRIMARY KEY,shipment_id TEXT NOT NULL,result_json TEXT);
CREATE TABLE IF NOT EXISTS demo_injections(shipment_id TEXT PRIMARY KEY,trace_id TEXT NOT NULL,json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS demo_runs(request_id TEXT PRIMARY KEY,shipment_id TEXT NOT NULL);`);
const insertShipment = db.prepare("INSERT OR IGNORE INTO shipments(id,json,version) VALUES(?,?,0)");
for (const s of seed) insertShipment.run(s.id, JSON.stringify(s));
const parse = <T>(r: unknown): T => JSON.parse((r as { json: string }).json) as T;
export const repository = {
  shipments: () =>
    db
      .prepare("SELECT json FROM shipments ORDER BY id")
      .all()
      .map(parse<Shipment>),
  shipment: (id: string) => {
    const r = db.prepare("SELECT json FROM shipments WHERE id=?").get(id);
    return r ? parse<Shipment>(r) : undefined;
  },
  saveShipment: (s: Shipment) =>
    db
      .prepare("UPDATE shipments SET json=?,version=version+1 WHERE id=?")
      .run(JSON.stringify(s), s.id),
  saveDisruption: (d: DisruptionAssessment) =>
    db
      .prepare("INSERT OR REPLACE INTO disruptions(id,shipment_id,json) VALUES(?,?,?)")
      .run(d.eventId, d.shipmentId, JSON.stringify(d)),
  disruption: (shipmentId: string) => {
    const r = db
      .prepare("SELECT json FROM disruptions WHERE shipment_id=? ORDER BY rowid DESC LIMIT 1")
      .get(shipmentId);
    return r ? parse<DisruptionAssessment>(r) : undefined;
  },
  saveDecision: (d: Decision) =>
    db
      .prepare("INSERT INTO decisions(id,request_id,shipment_id,json) VALUES(?,?,?,?)")
      .run(d.id, d.requestId, d.shipmentId, JSON.stringify(d)),
  updateDecision: (d: Decision) =>
    db.prepare("UPDATE decisions SET json=? WHERE id=?").run(JSON.stringify(d), d.id),
  decision: (shipmentId: string) => {
    const r = db
      .prepare("SELECT json FROM decisions WHERE shipment_id=? ORDER BY rowid DESC LIMIT 1")
      .get(shipmentId);
    return r ? parse<Decision>(r) : undefined;
  },
  decisions: () =>
    db
      .prepare("SELECT json FROM decisions ORDER BY rowid DESC")
      .all()
      .map(parse<Decision>),
  expiredTimedReviews: (nowIso: string) =>
    db
      .prepare("SELECT json FROM decisions ORDER BY rowid DESC")
      .all()
      .map(parse<Decision>)
      .filter(
        (decision) =>
          decision.overallStatus === "PENDING_APPROVAL" &&
          decision.autoCommitAfterReview === true &&
          Boolean(decision.reviewDeadlineIso) &&
          decision.reviewDeadlineIso! <= nowIso,
      ),
  workflowResults: () =>
    db
      .prepare("SELECT result_json FROM requests WHERE result_json IS NOT NULL ORDER BY rowid DESC")
      .all()
      .map(
        (row) =>
          JSON.parse((row as { result_json: string }).result_json) as Record<string, unknown>,
      ),
  activity: () =>
    db
      .prepare("SELECT json FROM activity ORDER BY rowid DESC LIMIT 200")
      .all()
      .map(parse<ActivityEvent>),
  addActivity: (e: ActivityEvent) =>
    db
      .prepare("INSERT OR IGNORE INTO activity(id,shipment_id,json) VALUES(?,?,?)")
      .run(e.id, e.shipmentId, JSON.stringify(e)),
  ledger: () =>
    db
      .prepare("SELECT json FROM ledger ORDER BY rowid DESC")
      .all()
      .map(parse<LedgerEntry>),
  ledgerOne: (id: string) => {
    const r = db.prepare("SELECT json FROM ledger WHERE id=?").get(id);
    return r ? parse<LedgerEntry>(r) : undefined;
  },
  appendLedger: (e: LedgerEntry) =>
    db
      .prepare("INSERT INTO ledger(id,action_id,json) VALUES(?,?,?)")
      .run(e.id, e.actionId ?? null, JSON.stringify(e)),
  actionByDecision: (id: string) =>
    db.prepare("SELECT json FROM actions WHERE decision_id=?").get(id) as
      { json: string } | undefined,
  saveAction: (id: string, decisionId: string, shipmentId: string, value: unknown) =>
    db
      .prepare("INSERT INTO actions(id,decision_id,shipment_id,json) VALUES(?,?,?,?)")
      .run(id, decisionId, shipmentId, JSON.stringify(value)),
  saveDemoInjection: (shipmentId: string, traceId: string, disruption: DisruptionAssessment) =>
    db
      .prepare("INSERT OR REPLACE INTO demo_injections(shipment_id,trace_id,json) VALUES(?,?,?)")
      .run(shipmentId, traceId, JSON.stringify(disruption)),
  demoInjection: (shipmentId: string) => {
    const row = db.prepare("SELECT json FROM demo_injections WHERE shipment_id=?").get(shipmentId);
    return row ? parse<DisruptionAssessment>(row) : undefined;
  },
  consumeDemoInjection: (shipmentId: string, requestId: string) => {
    db.prepare("DELETE FROM demo_injections WHERE shipment_id=?").run(shipmentId);
    db.prepare("INSERT OR REPLACE INTO demo_runs(request_id,shipment_id) VALUES(?,?)").run(
      requestId,
      shipmentId,
    );
  },
  clearDemoData: () => {
    const affectedIds = new Set(seed.filter((shipment) => shipment.demoScenario).map((s) => s.id));
    for (const row of db.prepare("SELECT shipment_id FROM demo_injections").all() as Array<{
      shipment_id: string;
    }>)
      affectedIds.add(row.shipment_id);
    for (const row of db.prepare("SELECT shipment_id FROM demo_runs").all() as Array<{
      shipment_id: string;
    }>)
      affectedIds.add(row.shipment_id);
    const demoShipments = seed.filter((shipment) => affectedIds.has(shipment.id));
    const demoIds = new Set(demoShipments.map((shipment) => shipment.id));
    const ledgerRows = db.prepare("SELECT id,json FROM ledger").all() as Array<{
      id: string;
      json: string;
    }>;

    db.exec("BEGIN");
    try {
      const deleteLedger = db.prepare("DELETE FROM ledger WHERE id=?");
      for (const row of ledgerRows) {
        const entry = JSON.parse(row.json) as LedgerEntry;
        if (demoIds.has(entry.shipmentId)) deleteLedger.run(row.id);
      }

      for (const shipment of demoShipments) {
        db.prepare("DELETE FROM actions WHERE shipment_id=?").run(shipment.id);
        db.prepare("DELETE FROM decisions WHERE shipment_id=?").run(shipment.id);
        db.prepare("DELETE FROM disruptions WHERE shipment_id=?").run(shipment.id);
        db.prepare("DELETE FROM activity WHERE shipment_id=?").run(shipment.id);
        db.prepare("DELETE FROM requests WHERE shipment_id=?").run(shipment.id);
        db.prepare("UPDATE shipments SET json=?,version=version+1 WHERE id=?").run(
          JSON.stringify(shipment),
          shipment.id,
        );
      }
      db.prepare("DELETE FROM demo_injections").run();
      db.prepare("DELETE FROM demo_runs").run();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    return demoShipments.map((shipment) => shipment.id);
  },
  health: () => {
    db.prepare("SELECT 1").get();
    return true;
  },
};
