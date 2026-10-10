# Summit Therapeutics (SMMT): the oncology sample

The third built-in sample (**Load sample case → Summit — lung cancer, filed**), researched 2026-10-09. Unlike Stoke and PepGen it is finished, not a crib sheet. Every input is a disclosed figure or a judgment call, and each has an Evidence Log entry (lead program: HARMONi) giving its source and reasoning. This page lists the facts and the screens to check them against. Why the case exists, and what building it changed in the app, is in [`RxNPV_Oncology_Gap_Review.md`](RxNPV_Oncology_Gap_Review.md).

## The company

One molecule, **ivonescimab** (SMT112; AK112 at Akeso), a PD-1 × VEGF bispecific antibody. It is in-licensed from Akeso for the US, Canada, Europe, Japan, Latin America, the Middle East and Africa. Akeso keeps China, where the drug has been approved since 2024. Summit is modelled as five programs of that one drug:

| Program | Stage | Next gate | Odds to launch | Peak (Base) |
|---|---|---|---|---|
| HARMONi — 2L+ EGFRm NSCLC | BLA filed (Q4 2025, standard review) | FDA decision **2026-11-14** (pinned) | 75% | $0.64B |
| HARMONi-3 — 1L squamous NSCLC | Phase 3 | PFS readout **H2 2026** (pinned) | 55% | $2.47B |
| HARMONi-3 / -7 — 1L non-squamous NSCLC | Phase 3 | PFS events **H1 2027** (pinned) | 45% | $3.42B |
| HARMONi-GI3 — 1L metastatic CRC | Phase 3 | ~2028 (registry) | 30% | $2.10B |
| Further tumour types (Napkin) | — | — | 15% | $4.0B |

## Facts (sourced)

| Input | Value | Source |
|---|---|---|
| Price | $17.17 | Close 2026-10-08 |
| Common shares | 797,749,602 | Q2 2026 10-Q cover (2026-07-17) |
| Convertible preferred | 108,955,369 common as converted (108,955.37 preferred × 1,000, at $18.3561; AstraZeneca, $2.0B) | 8-K 2026-09-29 |
| Options / RSUs | 118,367,815 at $4.45 / 730,000 | Q2 2026 10-Q, note on equity |
| Cash | $690.7M (June 30) + $67.2M net ATM since + $2.0B AstraZeneca = **$2.76B** | Q2 2026 10-Q; 8-K 2026-09-29 |
| Burn | $43.9M a month (H1 2026 cash used in operations) | Q2 2026 10-Q |
| Facilities | $380M ATM (2026-07-23); automatic shelf | 8-K 2026-07-23; S-3ASR 2026-06-09 |
| Licence (Akeso) | Low-double-digit royalty (entered 11%); up to $1.05B regulatory and $3.505B commercial milestones | FY2025 10-K |
| Patents | Expire 2039–2040 before extension | FY2025 10-K |
| HARMONi PFS | HR 0.52 (0.41–0.66) | 8-K 2025-09-07 |
| HARMONi OS | 0.79 (0.62–1.01), p = 0.057 vs 0.0448 required; later 0.78 and 0.76 (nominal) | 8-K 2025-09-07, 2026-09-15 |
| HARMONi-A OS (China) | 0.74 (0.58–0.95) | 8-K 2025-11-07 |
| HARMONi-6 (China, squamous) | PFS 0.60 (0.46–0.78); OS 0.66 (0.50–0.87) | 8-K 2025-10-19; Q2 2026 release |
| HARMONi-2 (China, PD-L1+) | PFS 0.51; OS 0.73 (0.57–0.95); PD-L1 high 0.58, low 0.85 | 8-K 2026-09-13 |
| Market | 229,410 lung and 158,850 colorectal cancers a year (US) | ACS Cancer Facts & Figures 2026 |
| Price anchor | Keytruda: $55.72 a mg in Medicare Part B (2024); $79,464 per beneficiary a year | CMS Part B Spending by Drug |

## What the sample shows (2026-10-09; check these after any change)

- **Overview headline:** Bear **$5.13**, Base **$8.35**, Bull **$12.79**. If every program works: ~**$18.06**. That is about 995M diluted shares, after the Akeso royalty and milestones.
- **What each catalyst is worth (30% read-across):**

  | Catalyst | If it passes | If it fails |
  |---|---|---|
  | FDA decision, 2026-11-14 | $9.19 | $5.81 |
  | Squamous readout | $11.03 | $4.99 |
  | Non-squamous readout | $11.69 | $5.03 |

  Set read-across to 0 and the swings narrow.
- **Range of endings:** 214 ways to end, median ~$7.05, **92.5% below the price**. The most likely outcome is two of five programs reaching market.
- **Sum-of-the-parts** has its own line: "Owed to Akeso Inc. on total drug sales (shared)".
- **Capital structure → Convertible preferred:** 108,955,369. Moving it into the convertible-note fields would cost about $2.20 a share.
- **Program tabs** read as five distinct names. Akeso's terms sit on HARMONi; the others say "covered by the Akeso Inc. licence on HARMONi".
- **Tools:**
  - Trial Explorer's "who reads out first" with the rival-drug list shows five rival PD-1/VEGF Phase 3s, 2026–2031.
  - The Catalyst Calendar's FDA helper gives 2026-11-13 from a 2025-11-14 submission.
  - Exclusivity's patent estimator gives ~2040-11 (the 14-year cap binds).
- **Simulation:**
  - Subgroup Check finds no evidence that HARMONi-2's PD-L1 subgroups differ (p ≈ 0.16).
  - P-value ↔ CI with 0.80 as the smallest effect that matters reads HARMONi's OS as "not definitive".
  - The Meta-Analysis pools HARMONi-A and HARMONi OS.

## Where the case is a judgment, and could reasonably differ
- **Odds per indication** (75 / 55 / 45 / 30 / 15%).
- **Peak share:**
  - 25% in EGFRm;
  - 35% in squamous;
  - 25% in non-squamous;
  - 20% in CRC.
- **Price parity with pembrolizumab** per dose.
- **The two populations** behind the squamous and non-squamous programs.
- **Read-across (30%).**
- **How Akeso's undisclosed milestone thresholds are spread.**
- **$4B at 15% odds for the further tumour types.**

The Evidence Log says why each was chosen. Change any of them and the Overview, the catalyst table and the endings move together.
