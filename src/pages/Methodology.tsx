import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Disclosure, DisclosureText } from '../components/ui/Disclosure'
import { Callout, DefinitionList, Section } from '../components/ui/Section'

/**
 * Methodology.
 *
 * Documentation rather than an operational screen, so it uses the same card and section
 * language as the rest of the app but at a slower pace: numbered process steps, side-by-side
 * configuration comparison, and the limitations stated in full rather than buried.
 */
export default function Methodology() {
  return (
    <>
      <PageHeader
        title="Methodology"
        description="How the system works, what it contributes, and what its results can and cannot claim."
      />

      <div className="space-y-9 px-6 pb-12 lg:px-8">
        <Section
          eyebrow="Architecture"
          title="Four components, one closed loop"
          description="Three machines on a host-only network, plus a cloud LLM. No technique traffic leaves the lab."
        >
          <ArchitectureDiagram />
        </Section>

        <Section
          eyebrow="Approach"
          title="The evaluation loop"
          description="An iterative process where the agent learns, adapts and improves over time."
        >
          <Pipeline />
          <div className="mt-6">
            <Callout>
              The first five stages are the red agent's cycle within a single trial. The last is a
              separate loop that runs over accumulated results rather than inside any trial.
            </Callout>
          </div>
        </Section>

        <Section
          eyebrow="Configuration"
          title="Run modes"
          description="Two configurations to evaluate the system."
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ModeCard
              label="Agentic"
              title="Adaptive, closed loop"
              body="The full loop. The agent picks techniques and delays, sees the results, and adapts. Trials carry the injected delay and the agent's written reasoning."
              accent="border-red-line"
              rows={[
                { term: 'Technique selection', value: 'Dynamic (agent-driven)' },
                { term: 'Inter-command delay', value: 'Tunable (learned)' },
                { term: 'Reasoning', value: 'Stored per trial' },
                { term: 'Adaptation', value: 'Yes' },
              ]}
            />
            <ModeCard
              label="Static"
              title="Fixed schedule baseline"
              body="A fixed schedule with no adaptation and no reasoning — the control condition. Without it, a change in detection rate could not be attributed to the agent."
              accent="border-border-strong"
              rows={[
                { term: 'Technique selection', value: 'Predefined list' },
                { term: 'Inter-command delay', value: 'Fixed schedule' },
                { term: 'Reasoning', value: 'None recorded' },
                { term: 'Adaptation', value: 'No' },
              ]}
            />
          </div>
        </Section>

        <Section
          eyebrow="Key ideas"
          title="Novel contributions"
          description="What this project does differently from a standard emulation exercise."
        >
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
            <Note accent="border-blue-line" title="Temporal adaptation">
              Inter-command delay is treated as a tunable evasion parameter rather than a fixed
              setting. The agent escalates it trial over trial and keeps a per-technique record of
              what worked.
            </Note>
            <Note accent="border-blue-line" title="Persistent cross-trial memory">
              Reasoning from earlier trials feeds into later planning, so the agent accumulates
              strategy instead of restarting from a blank prompt each run.
            </Note>
            <Note accent="border-blue-line" title="Co-evolutionary Blue Agent">
              The defence side is agentic too. It reads its own detection gaps and proposes rules,
              so the two sides iterate against each other rather than against a static
              configuration.
            </Note>
            <Note accent="border-blue-line" title="Evasion Persistence Score">
              A per-technique measure of whether detection decayed across the campaign, comparing
              the detection rate of the chronological early and late halves of a technique's
              trials.
            </Note>
          </div>
        </Section>

        <Section
          eyebrow="Scope"
          title="Limitations"
          description="These bound what the results can claim. They are stated here rather than omitted."
        >
          <div className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-2">
            <Note accent="border-amber-line" title="Sample sizes are small">
              Per-technique counts are in the tens at most, and the static baseline is smaller than
              the agentic set. The statistical tests have low power: failing to find a significant
              difference is expected and is not evidence that no difference exists.
            </Note>
            <Note accent="border-amber-line" title="The latency test does not measure evasion">
              Mann-Whitney U compares how fast detections happened. Whether a technique was evaded
              at all is a binary proportion, tested separately with Fisher's exact test.
            </Note>
            <Note accent="border-amber-line" title="One target, one configuration">
              All trials ran against a single Windows VM with one Wazuh ruleset and Sysmon
              configuration. Results characterise that deployment, not other estates.
            </Note>
            <Note accent="border-amber-line" title="A small, Caldera-supported technique subset">
              Only abilities present in the Caldera profile were available, so the technique set is
              not a representative sample of ATT&amp;CK — and six techniques cannot support claims
              about ATT&amp;CK as a whole.
            </Note>
            <Note accent="border-amber-line" title="Technique order is not randomised">
              The agent chooses what to run next based on prior results, so technique, delay and
              position in the campaign are correlated by construction. Trends over time reflect the
              agent's choices as well as the environment.
            </Note>
            <Note accent="border-amber-line" title="Detections are rule matches, not ground truth">
              A detection means a Wazuh rule fired, not that an analyst would have acted on it.
              Alert volume says nothing about severity or triage cost.
            </Note>
            <Note accent="border-amber-line" title="Silent misses are ambiguous">
              A trial with no detection and no alerts cannot be distinguished from a pipeline
              failure using trial data alone. Pipeline Health surfaces the pattern but cannot
              resolve individual cases.
            </Note>
            <Note accent="border-amber-line" title="Trials are not independent draws">
              Because each technique is selected based on earlier outcomes, the independence
              assumption behind the significance tests is not fully met. p-values should be read as
              indicative.
            </Note>
          </div>
        </Section>

        <Section eyebrow="Reference" title="Statistical methods">
          <Disclosure summary="Statistical methods in detail">
            <DisclosureText>
              <strong className="font-medium text-ink">Detection rate</strong> is the share of a
              technique's trials in which Wazuh raised at least one alert. It is a proportion, not
              a mean, so it is analysed with Fisher's exact test rather than a t-test.
            </DisclosureText>
            <DisclosureText>
              <strong className="font-medium text-ink">Median detection time</strong> is computed
              across detected trials only. An undetected trial has no time to detect, so treating
              it as zero or infinity would distort the figure.
            </DisclosureText>
            <DisclosureText>
              <strong className="font-medium text-ink">Mann-Whitney U</strong> is used for
              time-to-detect because detection latencies are not normally distributed. The
              implementation uses the normal approximation with tie and continuity corrections,
              which matches what scipy produces at these sample sizes.
            </DisclosureText>
            <DisclosureText>
              <strong className="font-medium text-ink">Evasion Persistence Score</strong> sorts a
              technique's trials chronologically, splits them at floor(N/2), and compares the
              detection rate of the two halves. Fewer than four trials returns no score, because
              the halves would be too small to mean anything.
            </DisclosureText>
          </Disclosure>
        </Section>
      </div>
    </>
  )
}

function ModeCard({
  label,
  title,
  body,
  rows,
  accent,
}: {
  label: string
  title: string
  body: string
  rows: { term: string; value: string }[]
  accent: string
}) {
  return (
    <div className={`rounded-lg border ${accent} bg-surface-2 p-5`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</p>
      <h3 className="t-section mt-1.5 text-ink">{title}</h3>
      <p className="t-body mt-2 text-ink-muted">{body}</p>
      <DefinitionList items={rows} className="mt-5" />
    </div>
  )
}

function Note({
  title,
  accent,
  children,
}: {
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div className={`border-l-2 pl-4 ${accent}`}>
      <h3 className="t-card text-ink">{title}</h3>
      <p className="t-body mt-1 text-ink-muted">{children}</p>
    </div>
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

/** Numbered process steps, connected left-to-right on wide screens and stacked below. */
function Pipeline() {
  return (
    <ol className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-6">
      {STAGES.map((stage, index) => (
        <li key={stage.name} className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <span className="t-secondary flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-line bg-blue-tint text-blue">
              {index + 1}
            </span>
            {index < STAGES.length - 1 && (
              <span className="hidden h-px flex-1 bg-border-strong lg:block" aria-hidden="true" />
            )}
          </div>

          <p className="t-card mt-4 text-ink">{stage.name}</p>
          <p className="t-secondary text-ink-faint">{stage.actor}</p>
          <p className="t-secondary mt-2 text-ink-muted">{stage.body}</p>
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
    <Card variant="card" className="overflow-hidden">
      <div className="scroll-thin overflow-x-auto p-5">
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
    </Card>
  )
}
