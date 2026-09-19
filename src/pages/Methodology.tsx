import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Disclosure, DisclosureText } from '../components/ui/Disclosure'

/**
 * Methodology.
 *
 * Documentation, not an operational screen: the pipeline is a diagram rather than a numbered
 * list of paragraphs, and the long-form reasoning sits behind disclosures. The limitations stay
 * fully visible — they bound what the results can claim, which is what a reader at this page
 * most needs.
 */
export default function Methodology() {
  return (
    <>
      <PageHeader
        title="Methodology"
        description="How the system works, what it contributes, and what its results can and cannot claim."
      />

      <div className="space-y-10 px-6 pb-12 lg:px-8">
        <Card title="Architecture">
          <ArchitectureDiagram />
        </Card>

        <Card title="The evaluation loop">
          <Pipeline />
          <p className="t-body mt-5 max-w-3xl text-ink-muted">
            The first five stages are the red agent's cycle within a trial. The last is a separate
            loop that runs over accumulated results rather than inside any single trial.
          </p>
        </Card>

        <Card title="Run modes">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <h3 className="flex items-center gap-2 t-card text-ink">
                <span className="h-2 w-2 rounded-sm bg-red" aria-hidden="true" />
                Agentic
              </h3>
              <p className="t-body mt-2 text-ink-muted">
                The full loop. The agent picks techniques and delays, sees the results, and adapts.
                Trials carry the injected delay and the agent's written reasoning.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="flex items-center gap-2 t-card text-ink">
                <span className="h-2 w-2 rounded-sm bg-miss" aria-hidden="true" />
                Static
              </h3>
              <p className="t-body mt-2 text-ink-muted">
                A fixed schedule with no adaptation and no reasoning — the control condition.
                Without it, a change in detection rate could not be attributed to the agent.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Novel contributions">
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
            <Contribution
              title="Temporal adaptation"
              body="Inter-command delay is treated as a tunable evasion parameter rather than a fixed setting. The agent escalates it trial over trial and keeps a per-technique record of what worked."
            />
            <Contribution
              title="Persistent cross-trial memory"
              body="Reasoning from earlier trials feeds into later planning, so the agent accumulates strategy instead of restarting from a blank prompt each run."
            />
            <Contribution
              title="Co-evolutionary Blue Agent"
              body="The defence side is agentic too. It reads its own detection gaps and proposes rules, so the two sides iterate against each other rather than against a static configuration."
            />
            <Contribution
              title="Evasion Persistence Score"
              body="A per-technique measure of whether detection decayed across the campaign, comparing the detection rate of the chronological early and late halves of a technique's trials."
            />
          </div>
        </Card>

        <Card title="Limitations">
          <p className="t-body mb-5 max-w-3xl text-ink-muted">
            These bound what the results can claim. They are stated here rather than omitted.
          </p>
          <ul className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-2">
            <Limitation title="Sample sizes are small.">
              Per-technique counts are in the tens at most, and the static baseline is smaller than
              the agentic set. The statistical tests have low power: failing to find a significant
              difference is expected and is not evidence that no difference exists.
            </Limitation>
            <Limitation title="The latency test does not measure evasion.">
              Mann-Whitney U compares how fast detections happened. Whether a technique was evaded
              at all is a binary proportion, tested separately with Fisher's exact test.
            </Limitation>
            <Limitation title="One target, one configuration.">
              All trials ran against a single Windows VM with a single Wazuh ruleset and Sysmon
              configuration. Results characterise that deployment, not other estates.
            </Limitation>
            <Limitation title="A small, Caldera-supported technique subset.">
              Only abilities present in the Caldera profile were available, so the technique set is
              not a representative sample of ATT&amp;CK — and six techniques cannot support claims
              about ATT&amp;CK as a whole.
            </Limitation>
            <Limitation title="Technique order is not randomised.">
              The agent chooses what to run next based on prior results, so technique, delay and
              position in the campaign are correlated by construction. Trends over time reflect the
              agent's choices as well as the environment.
            </Limitation>
            <Limitation title="Detections are rule matches, not ground truth.">
              A detection means a Wazuh rule fired, not that an analyst would have acted on it.
              Alert volume says nothing about severity or triage cost.
            </Limitation>
            <Limitation title="Silent misses are ambiguous.">
              A trial with no detection and no alerts cannot be distinguished from a pipeline
              failure using trial data alone. Pipeline Health surfaces the pattern but cannot
              resolve individual cases.
            </Limitation>
            <Limitation title="Trials are not independent draws.">
              Because each technique is selected based on earlier outcomes, the independence
              assumption behind the significance tests is not fully met. p-values should be read as
              indicative.
            </Limitation>
          </ul>
        </Card>

        <Disclosure summary="Statistical methods in detail">
          <DisclosureText>
            <strong className="font-medium text-ink">Detection rate</strong> is the share of a
            technique's trials in which Wazuh raised at least one alert. It is a proportion, not a
            mean, so it is analysed with Fisher's exact test rather than a t-test.
          </DisclosureText>
          <DisclosureText>
            <strong className="font-medium text-ink">Median detection time</strong> is computed
            across detected trials only. An undetected trial has no time to detect, so treating it
            as zero or infinity would distort the figure.
          </DisclosureText>
          <DisclosureText>
            <strong className="font-medium text-ink">Mann-Whitney U</strong> is used for
            time-to-detect because detection latencies are not normally distributed. The
            implementation uses the normal approximation with tie and continuity corrections, which
            matches what scipy produces at these sample sizes.
          </DisclosureText>
          <DisclosureText>
            <strong className="font-medium text-ink">Evasion Persistence Score</strong> sorts a
            technique's trials chronologically, splits them at floor(N/2), and compares the
            detection rate of the two halves. Fewer than four trials returns no score, because the
            halves would be too small to mean anything.
          </DisclosureText>
        </Disclosure>
      </div>
    </>
  )
}

function Contribution({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="t-card text-ink">{title}</h3>
      <p className="t-body mt-1 text-ink-muted">{body}</p>
    </div>
  )
}

function Limitation({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="border-l-2 border-amber-line pl-3.5">
      <h3 className="t-card text-ink">{title}</h3>
      <p className="t-body mt-1 text-ink-muted">{children}</p>
    </li>
  )
}

const STAGES = [
  { name: 'Plan', actor: 'Red Agent', body: 'Picks a technique and an inter-command delay.' },
  { name: 'Execute', actor: 'Caldera', body: 'Runs the ability through the Sandcat agent.' },
  { name: 'Observe', actor: 'Sysmon + Wazuh', body: 'Events reach the manager on the host.' },
  { name: 'Score', actor: 'Backend', body: 'Detected or not, alert count, seconds to first alert.' },
  { name: 'Adapt', actor: 'Red Agent', body: 'Result and reasoning enter persistent memory.' },
  {
    name: 'Blue response',
    actor: 'Blue Agent',
    body: 'A weak technique becomes a proposed rule for human review.',
  },
]

/** The loop as a vertical pipeline rather than six paragraphs. */
function Pipeline() {
  return (
    <ol className="flex flex-col">
      {STAGES.map((stage, index) => (
        <li key={stage.name} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue" aria-hidden="true" />
            {index < STAGES.length - 1 && (
              <span className="w-px flex-1 bg-border-strong" aria-hidden="true" />
            )}
          </div>

          <div className={index < STAGES.length - 1 ? 'pb-5' : ''}>
            <p className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="t-card text-ink">{stage.name}</span>
              <span className="t-secondary text-ink-faint">{stage.actor}</span>
            </p>
            <p className="t-body mt-0.5 text-ink-muted">{stage.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Inline SVG rather than an image asset — stays crisp, themes with the tokens, no extra file. */
function ArchitectureDiagram() {
  const box = 'fill-[var(--surface-2)] stroke-[var(--border-strong)]'
  const inner = 'fill-[var(--surface)] stroke-[var(--border)]'
  const label = 'fill-[var(--ink)] text-[12px] font-medium'
  const sub = 'fill-[var(--ink-faint)] text-[11px]'

  return (
    <div className="scroll-thin overflow-x-auto">
      <svg
        viewBox="0 0 900 400"
        className="h-auto w-full min-w-[720px]"
        role="img"
        aria-label="Architecture: Kali VM running Caldera and both agents, a Windows 11 target running Sysmon and the Wazuh agent, and the Windows host running Wazuh in Docker"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
          </marker>
        </defs>

        <rect x="330" y="0" width="240" height="46" rx="8" className={box} strokeDasharray="4 3" />
        <text x="346" y="20" className={label}>Gemini API (cloud)</text>
        <text x="346" y="35" className={sub}>technique planning · gap analysis</text>

        <rect x="20" y="90" width="260" height="196" rx="8" className={box} />
        <text x="34" y="112" className={label}>Kali VM (VirtualBox)</text>
        <text x="34" y="127" className={sub}>192.168.56.101</text>

        <rect x="34" y="138" width="232" height="30" rx="4" className={inner} />
        <text x="44" y="157" className={sub}>Caldera server · port 8888</text>
        <rect x="34" y="174" width="232" height="30" rx="4" className={inner} />
        <text x="44" y="193" className={sub}>Agent backend API · port 8000</text>
        <rect x="34" y="210" width="110" height="30" rx="4" className={inner} />
        <text x="44" y="229" className={sub}>Red Agent</text>
        <rect x="156" y="210" width="110" height="30" rx="4" className={inner} />
        <text x="166" y="229" className={sub}>Blue Agent</text>
        <rect x="34" y="246" width="232" height="28" rx="4" className={inner} />
        <text x="44" y="264" className={sub}>Persistent trial memory</text>

        <rect x="330" y="90" width="240" height="196" rx="8" className={box} />
        <text x="344" y="112" className={label}>Windows 11 target VM</text>
        <text x="344" y="127" className={sub}>IP not recorded here</text>

        <rect x="344" y="138" width="212" height="30" rx="4" className={inner} />
        <text x="354" y="157" className={sub}>Sandcat agent (Caldera)</text>
        <rect x="344" y="174" width="212" height="30" rx="4" className={inner} />
        <text x="354" y="193" className={sub}>Sysmon · Windows event log</text>
        <rect x="344" y="210" width="212" height="30" rx="4" className={inner} />
        <text x="354" y="229" className={sub}>Wazuh agent</text>
        <rect x="344" y="246" width="212" height="28" rx="4" className={inner} />
        <text x="354" y="264" className={sub}>Techniques execute here</text>

        <rect x="620" y="90" width="260" height="196" rx="8" className={box} />
        <text x="634" y="112" className={label}>Windows host</text>
        <text x="634" y="127" className={sub}>192.168.56.1</text>

        <rect x="634" y="138" width="232" height="30" rx="4" className={inner} />
        <text x="644" y="157" className={sub}>Docker · Wazuh manager (single-node)</text>
        <rect x="634" y="174" width="232" height="30" rx="4" className={inner} />
        <text x="644" y="193" className={sub}>Wazuh indexer</text>
        <rect x="634" y="210" width="232" height="30" rx="4" className={inner} />
        <text x="644" y="229" className={sub}>Wazuh dashboard</text>
        <rect x="634" y="246" width="232" height="28" rx="4" className={inner} />
        <text x="644" y="264" className={sub}>This dashboard (browser)</text>

        <line x1="420" y1="46" x2="200" y2="90" className="stroke-[var(--border-strong)]" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <text x="216" y="70" className={sub}>LLM calls over HTTPS</text>

        <line x1="280" y1="238" x2="330" y2="238" className="stroke-[var(--border-strong)]" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <text x="284" y="232" className={sub}>abilities</text>

        <line x1="570" y1="225" x2="620" y2="225" className="stroke-[var(--border-strong)]" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <text x="575" y="219" className={sub}>events</text>

        <path
          d="M 700 286 L 700 330 L 150 330 L 150 286"
          fill="none"
          className="stroke-[var(--border-strong)]"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          markerEnd="url(#arrow)"
        />
        <text x="316" y="348" className={sub}>
          dashboard reads trials and proposals from the backend API
        </text>
        <text x="316" y="364" className={sub}>
          results feed agent memory · gaps become proposed rules
        </text>

        <text x="20" y="390" className={sub}>
          Everything except the LLM runs on the host-only network 192.168.56.0/24.
        </text>
      </svg>
    </div>
  )
}
