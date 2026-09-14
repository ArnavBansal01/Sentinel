# Model Card: Sentinel Local Decision Prototype

## Identity

- **Model type:** Multinomial Naive Bayes text classifier
- **Artifact:** `artifacts/sentinel-local-prototype.json`
- **Version:** Format version 1
- **Output classes:** `reroute`, `respeed`, `switch_mode`
- **External API required for inference:** No

## Intended use

Architecture demonstration and offline experimentation for recovery-option classification. It shows how a future locally hosted model can be trained, versioned, evaluated, and loaded without exposing operational text to an external language-model API.

## Data

The checked-in dataset contains 30 synthetic, manually labeled educational examples. It contains no confidential carrier data and no claim of representing the distribution of real disruptions. The artifact records the dataset SHA-256 so a reviewer can verify provenance.

## Evaluation

`evaluate.mjs` uses deterministic five-fold cross-validation. The generated `artifacts/evaluation.json` is the authoritative result. Performance on this small dataset must not be generalized to production traffic.

## Limitations

- This is not a large language model and does not generate free-form reasoning.
- It has a small vocabulary and cannot reliably handle novel operational language.
- The labels were created for demonstration and have not been reviewed by maritime domain experts.
- It must not autonomously execute shipment changes.
- Hard safety constraints and human approval remain mandatory regardless of model output.

## Current deployment disclosure

The live Sentinel Flash MVP still uses Gemini for option-language generation. Route economics are recalculated by server code and deterministic policies decide whether an option is allowed, auto-committed, or sent for approval. This local artifact is not secretly substituted into that flow.

## Production direction

A production model would require licensed historical decisions, expert-reviewed labels, train/validation/test separation by incident and time, calibration, adversarial tests, drift monitoring, model/version logging, and approval before deployment. A fine-tuned open-weight language model could then replace Gemini for explanation and option generation while deterministic systems retain final safety authority.
