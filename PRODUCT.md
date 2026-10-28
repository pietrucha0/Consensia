# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners and members of a housing community or cooperative (wspólnota mieszkaniowa / spółdzielnia). For them voting is a formal duty with legal weight, not an engagement feature: they come to read a resolution carefully, cast a vote once, and later rely on the recorded result. Precision and a trustworthy record matter more than speed or delight.

Roles:
- **Member (USER)** — reads announcements, reviews resolutions, votes once per resolution, sees results after voting.
- **Moderator (MODERATOR)** — prepares and runs resolution votes (draft → active → closed).
- **Administrator (ADMIN)** — publishes articles, manages users, has full access.

## Product Purpose

A private, invitation-only place where the community's board publishes announcements and puts resolutions to a vote, and where every eligible member casts exactly one final vote. Success: a resolution's outcome is unambiguous, provably one vote per member, and nobody can alter or retract a vote after the fact.

## Positioning

Voting integrity is enforced by the database itself, not just the interface: one vote per member per resolution (unique constraint), immutable votes (UPDATE/DELETE rejected by trigger), votes accepted only while a resolution is open (trigger with row lock), and vote options bound to their resolution (composite foreign key). The whole platform is a walled garden: nothing — articles, resolutions, images — is visible without a verified account.

## Operating Context

- Replaces or supplements paper voting and meeting-based voting, e.g. collecting votes individually between general meetings.
- Members vote rarely but deliberately; a resolution is read in full (title, justification, attachment) before voting.
- Results are hidden until the member has voted (blind voting), then shown as totals and percentages.
- Four interface languages: English (default), Polish, Spanish, French. Content can exist in any subset; readers fall back to English, then any available language.
- Date display and date filters use the organisation's time zone (`APP_TIME_ZONE`, default Europe/Warsaw).

## Capabilities and Constraints

- Built: email + password accounts with email verification and password reset; database sessions (revocable); article feed with search, sorting, date filter; article CMS for ADMIN; authenticated image uploads.
- Resolutions: title, detailed description / legal justification, optional image and attachment URL, custom options (default For / Against / Abstain), statuses DRAFT → ACTIVE → CLOSED, optional closing deadline.
- Ballots are **open (jawne)**: the system records which member chose which option. Members themselves see only aggregate results.
- Every verified, non-disabled account may vote — members, moderators and administrators alike (board members are usually owners too).
- Casting a vote is two steps: select an option, then confirm in a dialog that restates the choice and that it cannot be changed.
- After voting, the member sees live results (count and percentage per option) plus turnout: votes cast out of eligible members. Before voting, results and turnout are hidden.
- Terminology (PL): uchwała, głosowanie, głos, „Za” / „Przeciw” / „Wstrzymuję się”, zarząd, członek.
- **Undecided:** weighted voting by ownership share (udziały) — currently one account = one vote; quorum and majority rules; who is eligible to vote on a given resolution (currently every verified member); registration is open to anyone who verifies an email (invite-only not decided).

## Brand Commitments

- Name: **Consensia**.
- Palette chosen by the owner: Tailwind slate + emerald — primary action `#047857`, non-text accent `#10B981`, ink `#0F172A`, muted text `#64748B`, background `#F8FAFC`, cards `#FFFFFF`, borders `#E2E8F0`, input borders `#94A3B8`, destructive `#DC2626`, warning text `#B45309`.
- The brand colour must not signal a preferred answer: voting options look equal before a vote is cast.

## Evidence on Hand

- No real community name, members, resolutions, logos or legal documents yet. Demo articles in `prisma/seed.ts` are placeholders. Do not fabricate member counts, legal citations, testimonials or real resolution outcomes.

## Product Principles

1. **Integrity over convenience** — anything that affects a vote is enforced server-side and in the database, never only in the UI.
2. **Neutral by design** — the interface never nudges a vote: equal visual weight for options, results hidden until voting.
3. **Legible to everyone** — formal text must be easy to read in full; clear state (open, closed, already voted) at a glance.
4. **Private by default** — no content, media or metadata leaks to anyone without a verified session.
5. **A record you can trust** — timestamps, statuses and results are unambiguous and final.

## Accessibility & Inclusion

WCAG 2.2 AA as the baseline (contrast-checked palette, keyboard access, labelled controls, not colour-only result encoding). Multilingual UI with correct plural forms.
