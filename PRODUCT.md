# Product

## Register

product

## Users

Boxers, coaches, and training partners configuring and running interval workouts from a phone, often in a gym where the interface must stay legible and quick to operate.

## Product Purpose

Box Timer is a standalone PWA for creating reusable boxing and workout sessions, assigning people to rounds, and running dependable work/rest timers with clear audio and visual feedback.

## Brand Personality

Focused, direct, and dependable. The interface should feel like practical training equipment: calm while configuring a workout and unmistakable while a timer is running.

## Anti-references

Avoid generic fitness dashboards, decorative gamification, and navigation that unexpectedly replaces the workout editor or hides its persistent controls.

## Design Principles

- Keep the current task and primary controls visible.
- Make repeated workout setup fast by carrying useful configuration forward.
- Reveal advanced controls in the context of the round they affect.
- Prefer familiar, touch-friendly controls that remain clear under gym conditions.
- Use motion to explain state changes without slowing the user down.

## Group Training Model

- A configured round contains an ordered queue of partners.
- Every Group Training round requires shared work time and workout instructions,
  plus rest time except on the final round.
- Partners work one after another and inherit the round settings unless their
  work time, rest time, or instructions are explicitly overridden.
- The live timer always shows the active partner’s name and instructions.
- Adding a round copies the previous round’s shared settings, partner queue,
  and partner overrides, then allows independent editing.
- Partner configuration opens as a bottom sheet; workout-type selection and partner settings never replace the persistent workout editor header.

## Accessibility & Inclusion

Maintain strong text contrast, clear focus states, descriptive accessible labels, comfortable touch targets, and reduced-motion alternatives. Do not rely on color alone to communicate state.
