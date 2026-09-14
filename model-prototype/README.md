# Sentinel Local Decision Model — Prototype

This directory proves that Sentinel Flash can train and run a small model locally without sending its input to an external AI API.

## What it is

- A genuinely trained multinomial Naive Bayes text classifier.
- A proof of concept for selecting `reroute`, `respeed`, or `switch_mode` from a disruption description.
- Fully reproducible: dataset, training code, model artifact, evaluation, and inference demo are included.

## What it is not

- It is **not an LLM** and must not be presented as one.
- It is not used by the deployed production decision path.
- Its dataset is small, synthetic, and educational—not carrier operational training data.
- Its evaluation result does not establish real-world performance or safety.

The current deployed application uses Gemini for option-language generation, then recalculates economics server-side and applies deterministic safety policy. The planned final architecture replaces Gemini with a fine-tuned open-weight model trained on licensed, expert-reviewed disruption decisions. The deterministic policy and audit layers remain authoritative.

## Reproduce it

```bash
npm run model:train
npm run model:evaluate
npm run model:demo -- "canal closure with an available safe alternate route"
```

Training writes `artifacts/sentinel-local-prototype.json`. Evaluation writes `artifacts/evaluation.json`. The SHA-256 of the training dataset is embedded in the model artifact for provenance.

## Honest judge explanation

> We built a local train-and-infer prototype to validate the future architecture. It is a small classifier, not our final LLM. The live MVP currently uses Gemini for language generation, while server-side economics and deterministic safety rules control operational decisions. A production version would replace Gemini with a fine-tuned open-weight model using licensed, expert-reviewed data.
