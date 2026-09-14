import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import type { GeoPoint, Shipment } from "../types/domain.js";

export const EDITOR_PORTS: GeoPoint[] = [
  { name: "Antwerp", code: "BEANR", lat: 51.26, lon: 4.4 },
  { name: "Busan", code: "KRPUS", lat: 35.1, lon: 129.04 },
  { name: "Chennai", code: "INMAA", lat: 13.09, lon: 80.29 },
  { name: "Durban", code: "ZADUR", lat: -29.87, lon: 31.02 },
  { name: "Felixstowe", code: "GBFXT", lat: 51.95, lon: 1.32 },
  { name: "Hamburg", code: "DEHAM", lat: 53.54, lon: 9.98 },
  { name: "Jebel Ali", code: "AEJEA", lat: 25.01, lon: 55.06 },
  { name: "Los Angeles", code: "USLAX", lat: 33.74, lon: -118.27 },
  { name: "Mombasa", code: "KEMBA", lat: -4.04, lon: 39.66 },
  { name: "New York", code: "USNYC", lat: 40.67, lon: -74.05 },
  { name: "Ningbo", code: "CNNGB", lat: 29.87, lon: 121.54 },
  { name: "Rotterdam", code: "NLRTM", lat: 51.95, lon: 4.14 },
  { name: "Santos", code: "BRSSZ", lat: -23.95, lon: -46.33 },
  { name: "Seattle", code: "USSEA", lat: 47.6, lon: -122.34 },
  { name: "Shanghai", code: "CNSHA", lat: 31.23, lon: 121.47 },
  { name: "Singapore", code: "SGSIN", lat: 1.26, lon: 103.84 },
  { name: "Valencia", code: "ESVLC", lat: 39.44, lon: -0.31 },
];

export const ShipmentDraftSchema = z
  .object({
    id: z.string().trim().max(32).optional(),
    originCode: z.string().trim().min(3).max(8),
    destinationCode: z.string().trim().min(3).max(8),
    cargo: z.string().trim().min(2).max(160),
    cargoCategory: z.enum([
      "medicine",
      "electronics",
      "food",
      "chemicals",
      "automotive",
      "textiles",
      "machinery",
      "other",
    ]),
    quantity: z.coerce.number().positive().max(1_000_000_000),
    quantityUnit: z.enum(["units", "kg", "tonnes", "pallets", "containers", "litres"]),
    cargoValueUsd: z.coerce.number().positive().max(100_000_000_000),
    mode: z.enum(["ocean", "air", "rail"]),
    vessel: z.string().trim().min(2).max(120),
    etaIso: z.string().datetime({ offset: true }),
    temperatureMinC: z.coerce.number().min(-100).max(100).nullable().optional(),
    temperatureMaxC: z.coerce.number().min(-100).max(100).nullable().optional(),
    priority: z.enum(["standard", "high", "critical"]),
    reference: z.string().trim().max(80).optional().default(""),
    owner: z.string().trim().max(120).optional().default(""),
    notes: z.string().trim().max(1_000).optional().default(""),
    constraints: z.array(z.string().trim().min(2).max(240)).max(12).default([]),
    shelfLifeDays: z.coerce.number().positive().max(3650).optional(),
    downstreamCriticality: z.coerce.number().int().min(0).max(3).optional(),
  })
  .superRefine((draft, context) => {
    if (draft.originCode.toUpperCase() === draft.destinationCode.toUpperCase()) {
      context.addIssue({
        code: "custom",
        path: ["destinationCode"],
        message: "Origin and destination must be different",
      });
    }
    if (
      draft.temperatureMinC != null &&
      draft.temperatureMaxC != null &&
      draft.temperatureMinC > draft.temperatureMaxC
    ) {
      context.addIssue({
        code: "custom",
        path: ["temperatureMaxC"],
        message: "Maximum temperature must be greater than minimum temperature",
      });
    }
  });

export type ShipmentDraft = z.infer<typeof ShipmentDraftSchema>;

const portByCode = new Map(EDITOR_PORTS.map((port) => [port.code, port]));

export function normalizeShipmentDraft(input: unknown, actor: string): Shipment {
  const draft = ShipmentDraftSchema.parse(input);
  const origin = portByCode.get(draft.originCode.toUpperCase());
  const destination = portByCode.get(draft.destinationCode.toUpperCase());
  if (!origin || !destination) {
    throw Object.assign(
      new Error("Choose an origin and destination from the supported port list"),
      {
        status: 400,
        code: "UNSUPPORTED_PORT",
      },
    );
  }

  const coldChain = draft.temperatureMinC != null || draft.temperatureMaxC != null;
  const temperatureConstraint = coldChain
    ? `COLD CHAIN: continuous ${draft.temperatureMinC ?? "minimum not supplied"}–${draft.temperatureMaxC ?? "maximum not supplied"} °C custody`
    : undefined;
  const constraints = [
    ...new Set([temperatureConstraint, ...draft.constraints].filter(Boolean)),
  ] as string[];
  const lonDelta = ((destination.lon - origin.lon + 540) % 360) - 180;
  const midpointLon = ((origin.lon + lonDelta / 2 + 540) % 360) - 180;
  const valueRisk = draft.cargoValueUsd >= 1_000_000 ? 20 : draft.cargoValueUsd >= 250_000 ? 10 : 0;
  const riskScore = Math.min(
    90,
    12 +
      valueRisk +
      (coldChain ? 20 : 0) +
      (draft.priority === "critical" ? 25 : draft.priority === "high" ? 12 : 0),
  );

  return {
    id: (draft.id || `SF-${randomUUID().slice(0, 6)}`).toUpperCase(),
    origin,
    destination,
    position: { lat: (origin.lat + destination.lat) / 2, lon: midpointLon },
    cargo: draft.cargo,
    cargoCategory: draft.cargoCategory,
    quantity: draft.quantity,
    quantityUnit: draft.quantityUnit,
    cargoValueUsd: draft.cargoValueUsd,
    mode: draft.mode,
    vessel: draft.vessel,
    etaIso: draft.etaIso,
    riskScore,
    status: "monitoring",
    coldChain,
    ...(draft.temperatureMinC != null ? { temperatureMinC: draft.temperatureMinC } : {}),
    ...(draft.temperatureMaxC != null ? { temperatureMaxC: draft.temperatureMaxC } : {}),
    priority: draft.priority,
    ...(draft.reference ? { reference: draft.reference } : {}),
    ...(draft.owner ? { owner: draft.owner } : {}),
    ...(draft.notes ? { notes: draft.notes } : {}),
    ...(draft.shelfLifeDays !== undefined ? { shelfLifeDays: draft.shelfLifeDays } : {}),
    ...(draft.downstreamCriticality !== undefined
      ? { downstreamCriticality: draft.downstreamCriticality as 0 | 1 | 2 | 3 }
      : {}),
    constraints,
    demoScenario: false,
    currentState: "MONITORED",
    createdAtIso: new Date().toISOString(),
    createdBy: actor,
  };
}

export async function parseShipmentText(text: string): Promise<ShipmentDraft> {
  if (!process.env["GEMINI_API_KEY"]) {
    throw Object.assign(new Error("Gemini is not configured for automatic shipment extraction"), {
      status: 503,
      code: "GEMINI_NOT_CONFIGURED",
    });
  }
  if (!text.trim() || text.length > 120_000) {
    throw Object.assign(new Error("Provide shipment text between 1 and 120,000 characters"), {
      status: 400,
      code: "INVALID_IMPORT_TEXT",
    });
  }

  const ai = new GoogleGenAI({ apiKey: process.env["GEMINI_API_KEY"] });
  const response = await ai.models.generateContent({
    model: process.env["GEMINI_MODEL"] ?? "gemini-3.6-flash",
    contents: `Extract one shipment record from the supplied text. Do not invent missing business values. Use a null temperature when no temperature is stated. Match originCode and destinationCode to this supported port directory: ${JSON.stringify(EDITOR_PORTS)}. Return JSON only.\n\nShipment information:\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        required: [
          "originCode",
          "destinationCode",
          "cargo",
          "cargoCategory",
          "quantity",
          "quantityUnit",
          "cargoValueUsd",
          "mode",
          "vessel",
          "etaIso",
          "priority",
          "constraints",
        ],
        properties: {
          id: { type: "string" },
          originCode: { type: "string" },
          destinationCode: { type: "string" },
          cargo: { type: "string" },
          cargoCategory: {
            type: "string",
            enum: [
              "medicine",
              "electronics",
              "food",
              "chemicals",
              "automotive",
              "textiles",
              "machinery",
              "other",
            ],
          },
          quantity: { type: "number", minimum: 0.000001 },
          quantityUnit: {
            type: "string",
            enum: ["units", "kg", "tonnes", "pallets", "containers", "litres"],
          },
          cargoValueUsd: { type: "number", minimum: 0.01 },
          mode: { type: "string", enum: ["ocean", "air", "rail"] },
          vessel: { type: "string" },
          etaIso: { type: "string" },
          temperatureMinC: { type: ["number", "null"] },
          temperatureMaxC: { type: ["number", "null"] },
          priority: { type: "string", enum: ["standard", "high", "critical"] },
          reference: { type: "string" },
          owner: { type: "string" },
          notes: { type: "string" },
          constraints: { type: "array", items: { type: "string" } },
          shelfLifeDays: { type: "number", minimum: 0.01 },
          downstreamCriticality: { type: "number", minimum: 0, maximum: 3 },
        },
      },
    },
  });

  const parsed = ShipmentDraftSchema.safeParse(JSON.parse(response.text ?? ""));
  if (!parsed.success) {
    throw Object.assign(
      new Error(
        `Gemini could not produce a complete shipment draft: ${parsed.error.issues[0]?.message}`,
      ),
      { status: 422, code: "INVALID_SHIPMENT_EXTRACTION" },
    );
  }
  return parsed.data;
}
