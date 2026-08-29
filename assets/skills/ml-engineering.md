---
name: ml-engineering
description: Methodology for machine learning engineering — training pipelines, debugging loss divergence, ablation studies, experiment reproducibility, metric selection, and resource efficiency. Use when building or debugging ML training pipelines, selecting evaluation metrics, running ablations, or optimizing training resources.
use_for: Training pipelines, debugging loss divergence, ablation studies, reproducibility, resource efficiency.
dont_use_for: General software engineering with no ML component.
---

# ML Engineering Playbook

## Experiment Reproducibility

1. **Seed everything**: random seed for data shuffling, initialization, dropout, and any stochastic step. Record the seed in the experiment log.
2. **Pin the environment**: record library versions (torch/transformers/numpy) and the exact command that launched the run.
3. **Log hyperparameters as data**: write the full config to a file at run start, not just to stdout.
4. **Checkpoint deterministically**: fixed interval, named by step, so a failed run can resume.

## Debugging Loss Divergence

Work in this order — most divergences are configuration, not model:

1. **Data pipeline**: verify a batch loads, shapes/dtypes are correct, labels align with inputs. Print one real batch.
2. **Learning rate**: an LR that is 10× too high diverges in the first 100 steps. Try a 10× reduction before anything else.
3. **Gradient flow**: check gradient norms. Exploding → add clipping; zero → check for detached tensors or wrong dtype.
4. **Loss function**: verify the loss matches the task (e.g., BCE vs CE, label smoothing on/off).
5. **Numerics**: mixed-precision overflow (use loss scaling), NaN propagation (find the first step that produces NaN).

## Ablation Studies

- Change ONE variable at a time. Name each run by the variable changed.
- Always include the baseline run in the same comparison table.
- Report the metric delta, not just the absolute number.
- If a result is within noise (±1 standard error across seeds), call it a null result — do not over-interpret.

## Metric Selection

| Task | Primary metric | Watch-outs |
|------|----------------|------------|
| Classification (balanced) | F1 / accuracy | Accuracy is misleading under class imbalance |
| Classification (imbalanced) | Recall / AUC-PR | Report per-class, not just macro |
| Regression | MAE or RMSE (state which) | RMSE is sensitive to outliers |
| Generation | Task-specific (BLEU, exact match, human eval) | Never report a single metric without the eval set size |

## Resource Efficiency

- Start small: 1 GPU, small subset, few steps — verify the pipeline end-to-end before scaling.
- Profile before optimizing: measure data-loading time vs compute time; the bottleneck is usually I/O.
- Use gradient accumulation to simulate larger batches on limited memory.
- Stop early: plateau detection on the validation metric, not a fixed step count.

## Verification Checklist

- [ ] The exact command to reproduce the run is recorded.
- [ ] Seed is fixed and logged.
- [ ] The reported metric is computed on a held-out set, not the training set.
- [ ] The baseline comparison is in the same table.
- [ ] Any null results are labeled as such.
