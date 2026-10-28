Scope: member-facing resolution page (`/[locale]/resolutions/[id]`) and its list (`/[locale]/resolutions`). Visitor mode: Operate.

Audience and job: owners in a housing community casting one formal, final vote; they must see at a glance whether the vote is open, until when, and whether they already voted, then read and decide.

Constraints: open ballot; results and turnout hidden until the viewer votes (server-side); two-step vote (select, then confirm dialog restating the choice); options visually equal before the vote; every verified member may vote.

## Direction contract

THESIS: The page leads with the state of the vote, not a document header: one status band, the title, then the ballot; the justification follows. It refuses the category default of a long document with a lone vote button at the bottom and a big results chart.

OWN-WORLD: The incumbent Consensia system: slate ink on #F8FAFC, white surfaces with #E2E8F0 hairlines, Inter, emerald #047857 reserved for the committed action and the viewer's own choice. Options are achromatic and equal until chosen; results are flat slate bars, the viewer's option edged in emerald; all counts in tabular numerals.

STORY: The member understands in one glance: open or closed, deadline, voted or not. They choose one of equally weighted options, confirm in a dialog that restates the choice, and watch the ballot turn into results and turnout in place. The full justification is always one link away.

FIRST VIEWPORT: Back link; full-width status band (state, number, deadline, turnout readout that stays masked until the vote); H1 title; ballot of equal option tiles in one row on desktop, stacked on phones, as a radio group; "Cast vote" primary aligned right under the options; a link down to the justification.

FORM: Status-first decision panel, #5 of my ordered list, seed key 7763de41. Signature interaction: the ballot morphs in place into result bars, options holding their positions, bars growing from zero with an exponential ease-out. Raises: fixed-digit tabular turnout readout (from the nixie counter); one decision transforms the ballot in place (from the drawcord cape).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: weighted voting by ownership share; quorum/majority rules (not displayed).
