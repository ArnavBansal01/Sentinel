import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRows, predict, train } from "./train.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const rows = loadRows();
const labels = [...new Set(rows.map((row) => row.label))].sort();
const folds = 5;
const predictions = [];

for (let fold = 0; fold < folds; fold += 1) {
  const test = rows.filter((_, index) => index % folds === fold);
  const training = rows.filter((_, index) => index % folds !== fold);
  const model = train(training);
  for (const row of test) predictions.push({ expected: row.label, predicted: predict(model, row.text).label });
}

const confusionMatrix = Object.fromEntries(labels.map((expected) => [expected, Object.fromEntries(labels.map((predicted) => [predicted, 0]))]));
for (const item of predictions) confusionMatrix[item.expected][item.predicted] += 1;
const correct = predictions.filter((item) => item.expected === item.predicted).length;
const report = {
  evaluation: "5-fold cross-validation",
  dataset: "synthetic educational disruption scenarios",
  examples: rows.length,
  accuracy: correct / predictions.length,
  correct,
  total: predictions.length,
  confusionMatrix,
  warning: "Prototype metrics on a small synthetic dataset do not demonstrate production performance.",
};

writeFileSync(resolve(root, "artifacts/evaluation.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
