---
title: TallyTrain: Communication-Efficient Federated Distillation
paper: https://arxiv.org/abs/2607.00173
date: 2026. 7. 2
tags: [머신러닝, arXiv cs.LG]
summary: Federated learning is bandwidth-bound on two orthogonal axes: model size, which limits how often parameter-averaging methods can afford to merge, and class count, which makes per-probe soft-label distillation prohibitive at large vocabularies. Both ceilings tighten as modern systems scale. We collap
---
## 메타
- **출처**: arXiv cs.LG
- **저자**: Radhakrishna Achanta, Will Reed
- **발행일**: 2026. 7. 2. 오후 10:28:06
- **수집일**: 2026. 7. 2. 오후 10:28:06
- **지표**: 0

## 초록
Federated learning is bandwidth-bound on two orthogonal axes: model size, which limits how often parameter-averaging methods can afford to merge, and class count, which makes per-probe soft-label distillation prohibitive at large vocabularies. Both ceilings tighten as modern systems scale. We collapse the class-count axis to $\lceil \log_2 C \rceil$ bits per probe by transmitting only each peer's

---
*이 카드는 [paper.html](https://yangguibee.github.io/paper.html) 수집 데이터를 매일 자동 동기화한 것입니다. 원문을 직접 검토해 태그·핵심 키포인트를 보강할 수 있습니다.*
