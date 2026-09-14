import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(root, "data/training.jsonl");
const modelPath = resolve(root, "artifacts/sentinel-local-prototype.json");

export function loadRows(path = dataPath) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
}

export function tokens(text) {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function train(rows) {
  const labels = [...new Set(rows.map((row) => row.label))].sort();
  const documents = Object.fromEntries(labels.map((label) => [label, 0]));
  const tokenTotals = Object.fromEntries(labels.map((label) => [label, 0]));
  const counts = Object.fromEntries(labels.map((label) => [label, {}]));
  const vocabulary = new Set();

  for (const row of rows) {
    documents[row.label] += 1;
    for (const token of tokens(row.text)) {
      vocabulary.add(token);
      counts[row.label][token] = (counts[row.label][token] ?? 0) + 1;
      tokenTotals[row.label] += 1;
    }
  }

  return {
    formatVersion: 1,
    modelType: "multinomial-naive-bayes-text-classifier",
    purpose: "local recovery-option ranking prototype",
    limitations: [
      "Small synthetic educational dataset",
      "Not a large language model",
      "Not approved for autonomous production decisions",
    ],
    labels,
    trainingExamples: rows.length,
    vocabulary: [...vocabulary].sort(),
    documents,
    tokenTotals,
    counts,
  };
}

export function predict(model, text) {
  const input = tokens(text);
  const totalDocs = Object.values(model.documents).reduce((a, b) => a + b, 0);
  const vocabularySize = model.vocabulary.length;
  const scores = {};
  for (const label of model.labels) {
    let score = Math.log(model.documents[label] / totalDocs);
    const denominator = model.tokenTotals[label] + vocabularySize;
    for (const token of input) score += Math.log(((model.counts[label][token] ?? 0) + 1) / denominator);
    scores[label] = score;
  }
  const best = [...model.labels].sort((a, b) => scores[b] - scores[a])[0];
  return { label: best, scores };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = loadRows();
  const model = train(rows);
  const datasetSha256 = createHash("sha256").update(readFileSync(dataPath)).digest("hex");
  const artifact = { ...model, trainedAt: new Date().toISOString(), datasetSha256 };
  writeFileSync(modelPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Saved ${artifact.modelType} with ${rows.length} examples to ${modelPath}`);
}
