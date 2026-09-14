import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { predict } from "./train.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(readFileSync(resolve(root, "artifacts/sentinel-local-prototype.json"), "utf8"));
const text = process.argv.slice(2).join(" ") || "canal closure with safe alternate cape route for general cargo";
const result = predict(model, text);
console.log(JSON.stringify({ input: text, recommendation: result.label, model: model.modelType }, null, 2));
