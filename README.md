# Threat Emulation

Analyst dashboard for an autonomous red/blue agent research project: an AI red agent executes
MITRE ATT&CK techniques against a Windows target while an AI blue agent analyses what the SIEM
missed and proposes new detection rules.

Built as the presentation layer for *Autonomous Threat Emulation and Detection Using Agentic AI*.
The React app reads from a FastAPI backend running on the lab VM; it does not implement any
detection, execution or analysis logic itself.

## What it does

A **red agent** (Gemini) picks a technique and an inter-command delay, runs it through Caldera
against a Windows VM, and records whether Wazuh detected it. The delay is treated as a tunable
parameter — the agent escalates it across trials and keeps a per-technique record of what worked,
so evasion strategy accumulates instead of resetting each run.

A **blue agent** reads trials with weak detection, identifies the gap, and proposes a Wazuh rule.
Proposals are recorded for human review only. Nothing is auto-deployed.

The dashboard is the analyst's view onto both, plus the static baseline that makes the comparison
meaningful.

## Architecture

```
Kali VM (192.168.56.101)          Windows 11 target            Windows host (192.168.56.1)
  Caldera            :8888          Sandcat agent                Wazuh manager   ┐
  Backend API        :8000          Sysmon + event log           Wazuh indexer   ├ Docker
  Red Agent / Blue Agent            Wazuh agent                  Wazuh dashboard ┘
  Persistent trial memory                                        This dashboard (browser)
                    │                          │                            │
                    └───── host-only network 192.168.56.0/24 ────────────────┘
```

The Gemini API is the only thing that leaves the lab network.

## Pages

| Page | Answers |
| --- | --- |
| Overview | How is the campaign performing? What needs attention? |
| Live | Start a run and watch it happen |
| Trials | Every recorded trial, with the agent's reasoning |
| Techniques | Detection quality per technique, and whether it is changing |
| Compare | Agentic against the static baseline, with significance testing |
| Detection Gaps | Techniques ranked weakest-first |
| Blue Agent | Proposed rules awaiting review |
| Pipeline Health | Whether the pipeline is working, and whether misses are real |
| Reports | Publication figures rendered server-side (matplotlib) |
| Methodology | Architecture, approach and limitations |

## Getting started

Requires Node 20+ and the FastAPI backend running on the lab VM.

```bash
npm install
cp .env.example .env.local     # then set the VM's IP
npm run dev                    # http://localhost:5173
```

Other scripts:

```bash
npm run build          # typecheck + production bundle
npm run lint
npx playwright test    # renders every route at desktop and tablet width into screenshots/
```

### Backend location

`.env.local` holds the backend address and is gitignored, so each machine carries its own:

```
VITE_API_BASE=http://192.168.56.101:8000
VITE_WS_URL=ws://192.168.56.101:8000/ws/logs
```

The backend must bind to `0.0.0.0`, not `127.0.0.1`, or the host browser cannot reach it.
The connection is cross-origin, which the backend permits.

## Metrics

**Detection rate (TPR)** — the share of a technique's trials where Wazuh raised at least one
alert. A proportion, so it is tested with Fisher's exact test rather than a t-test.

**Median detection time (MTTD)** — median seconds to first alert, across *detected trials only*.
An undetected trial has no time to detect; coding it as zero or infinity would distort the figure.

**Evasion Persistence Score (EPS)** — whether detection decayed over the campaign. Trials are
sorted chronologically, split at `floor(N/2)`, and the detection rates of the two halves compared:

```
EPS = (early_rate - late_rate) / early_rate
```

Positive means detection fell off — evasion persisted. Negative means detection improved. Fewer
than four trials returns no score, because the halves would be too small to mean anything. This
mirrors the Python implementation exactly; the two must not drift apart.

**Significance tests** — Fisher's exact test for detection rate (the primary outcome), and
Mann-Whitney U for detection latency. These answer different questions: the latency test sees
only trials that were detected, so a technique evaded completely contributes nothing to it.
Neither result should be cited without the other.

## Limitations

Stated plainly, because they bound what the results can claim.

- **Sample sizes are small.** Per-technique counts are in the tens at most. The tests have low
  power, so a non-significant result is expected and is not evidence of no effect.
- **Trials are not independent draws.** Techniques are selected based on prior outcomes, so the
  independence assumption behind the significance tests is not fully met. p-values are indicative.
- **One target, one configuration.** All trials ran against a single Windows VM with one Wazuh
  ruleset and Sysmon config. Results characterise that deployment, not other estates.
- **A small, Caldera-supported technique subset.** Only abilities in the Caldera profile were
  available, so the technique set is not a representative sample of ATT&CK.
- **Technique order is not randomised.** Trends over time reflect the agent's choices as well as
  the environment.
- **Detections are rule matches, not ground truth.** A detection means a rule fired, not that an
  analyst would have acted.
- **Silent misses are ambiguous.** A trial with no detection and no alerts cannot be distinguished
  from a pipeline failure using trial data alone. Pipeline Health surfaces the pattern but cannot
  resolve individual cases.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Recharts · Playwright

No state-management library. One shared WebSocket and one health poll, both via React context.

## Layout

```
src/
  components/ui/       design-system primitives (Button, Card, Badge, Table, Drawer, …)
  components/domain/   project-specific (TrialDetail, ProposalCard, RuleXml, EpsMeter, …)
  components/layout/   app shell, sidebar, status bar
  context/             theme, shared WebSocket, health poll
  hooks/               one data hook per resource
  lib/api/             typed client, endpoints, backend contract
  lib/metrics/         tpr, eps, fisher, mannwhitney, distribution, streaks
  lib/insights.ts      plain-language findings derived from the data
  pages/               one file per route
```

## Backend

Not in this repository. The dashboard expects these endpoints:

```
GET  /api/status                  health, Caldera and Wazuh liveness
GET  /api/trials?mode=            agentic | static
GET  /api/trials/summary?mode=
GET  /api/blue-proposals
POST /api/blue-proposals/update
POST /api/run-batch
POST /api/run-blue-analysis
WS   /ws/logs
```
