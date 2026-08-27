# Product

## Register

product

## Users

Developers who run **more than one** dependency scanner on projects they
maintain. Coverage is why they added the second one; the cost is that the two
describe the same vulnerability under different identifiers, and nothing
downstream reconciles them. Adding a scanner made the reading longer without
making the project safer, so they stopped opening the reports.

This is the shape the tool is built around, and it is worth being blunt about
what follows from it. With one source there is nothing to reconcile: the
reduction is zero and the value is ranking alone. Measured on uptime-kuma, npm
audit by itself reports 71 and leaves 71; add osv-scanner and it is 142 in and
71 out. **The second source is the premise, not an optional extra**, and the
install instructions should stop calling it one.

The job: decide what to do next about dependency findings that arrived from
several tools at once, and be able to check that decision rather than take it
on faith.

Secondary reader: the same person a week later, asking whether things are
getting better or worse.

Getting them to the second scanner is our job, not somebody else's. This was
excluded once, on the grounds that teaching a first scan is a different product.
That was written for a world where onboarding means a human reading docs, and it
was already contradicted by our own package: `skills/setup` exists and its whole
job is the first run. It also gave away the thing that creates our value — a
reader with one source gets 0% from us, so declaring the step that produces our
user to be out of scope was declaring ourselves out of scope.

An agent doing the install changes the arithmetic. The setup skill installs the
second scanner, verifies it produced a report rather than assuming, and shows
the one-source and two-source numbers on the reader's own project — which is the
argument, and it is theirs rather than ours.

Still not this reader: someone who wants to be taught what a vulnerability is.
`npm install` already prints a count at them, and the gap there is not
knowledge, it is that nothing makes the count actionable.

> Written 2026-08-22 while designing the HTML report, and it showed: the
> original text described the person looking at *that page* — mid-task, browser
> tab among many — and was then read as the product's user for weeks. It sent
> the demo video and the report intro after a reader the product was never
> shaped for. Rewritten 2026-08-27 against what the code actually does.

## Product Purpose

Everything here is a judgement layer, not a scanner. Other tools find things;
this one decides which of them matter now, reconciles what two scanners each
called by a different name, and stays quiet about what has already been
accepted.

The reporting surfaces are three views of one judgement:

- the terminal, for the person who just ran it
- an agent reading the JSON, for the person who would rather be told
- a static HTML file, for the person who wants to look at it themselves

Success is that a reader finds the next action in seconds and can trace why it
is the next action.

## Brand Personality

Exact, unhurried, plainly spoken. It says what it measured and what it did not:
"fewer items", not "the right items", until labels exist to say otherwise. It
never congratulates itself, and it does not decorate a number to make it feel
larger.

Three words: evidential, deliberate, quiet.

Professional in the sense a lab result is professional: someone else could
check it.

## Anti-references

- **The security dashboard.** Dark navy chrome, donut charts, gauges, a "risk
  score" of 87 with nothing behind it. Every score in this product must be
  traceable to a rule and a number the reader can argue with; an invented
  composite is the exact opposite of what this tool sells.
- **Alarm design.** Red banners, sirens, "CRITICAL" in 48px. The findings are
  usually a version bump, and dressing them as an emergency is how people learn
  to close the tab.
- **Vendor marketing inside a tool.** Upsell blocks, logos, "powered by".
- **Cheerful emptiness.** Confetti, "You're all clear!", mascots. When nothing
  is outstanding, say so once and stop.

## Strategic Design Principles

1. **Show the evidence next to the claim.** Any number that ranks or summarises
   must sit within reach of what produced it.
2. **The next action is the headline.** A command someone can run outranks a
   description of a vulnerability.
3. **Severity is never encoded in colour alone.** Rank, position and label
   carry it; colour only reinforces.
4. **Nothing invented in the presentation layer.** The HTML shows what the
   judgement produced. No re-ranking, no synthesised scores, no rounding that
   flatters.
5. **Quiet by default, dense on demand.** The first screen answers "what now";
   the detail is present but does not compete.
6. **Legible outside English.** The report is read in several countries; its
   strings are translatable and its layout survives longer words.

## Accessibility

- Severity distinguishable without colour (rank word, order, numeric score).
- Text contrast at WCAG AA or better against its own background.
- Respect `prefers-reduced-motion`; no motion is required to understand
  anything.
- Keyboard-reachable interactive elements, visible focus.
- Print styling is not a goal yet.
