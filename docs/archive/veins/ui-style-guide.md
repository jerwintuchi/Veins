# Veins — UI & Controls Style Guide

> **Status:** Mixed (canon controls/UI + implemented HUD inventory + draft visual direction)
> **Sources:** GLOSSARY.md (Auto-Aim, Aim Override, PWA); DECISION_LOG.md (control-scheme entry; implemented UI components); SYSTEM DESIGN DOC.md §8.1; GPT_CHAT_HISTORY.txt (draft, "membranes not boxes")
> **See also:** [art-bible.md](art-bible.md) · [systems/combat.md](systems/combat.md) · [doctrines.md](doctrines.md)

## Purpose

This file governs **how the player inputs intent and reads state**. Its prime directive is the spine's hardest UI constraint: the interface must convey survival-critical information while *never* exposing the hidden interpretation layer (doctrine). Controls must be casual-accessible (mobile-first, low skill floor) without removing the ceiling co-op needs.

## Concepts

### Controls
- **Desktop:** WASD move + mouse aim. Always **manual aim**.
- **Mobile — virtual joystick:** left half moves; right half aims. Zero-vector on release.

### Auto-Aim (mobile default)
When the aim joystick is at rest, the game **auto-aims at the nearest alive enemy** (Euclidean distance, no cone bias — enemies approach from any direction, so a cone would create unfair dead zones). Fires toward that target without input. Range constant: `AUTO_AIM_RANGE = 250`. (Rejected: lowest-HP / highest-threat targeting — counterintuitive in chaos.)

### Aim Override
Moving the aim joystick (non-zero input) disables auto-aim and fires in the stick direction; releasing returns to auto. Desktop mouse-aim auto-reverts to auto after 500ms idle. Critical for targeting a specific minion during a boss fight.

### No explicit doctrine UI
Players never see doctrine scores ("Sanctum +12") — only effects. Threshold crossings surface only as flavor-text toasts (the doctrine itself omitted from the payload). See [doctrines.md](doctrines.md), [systems/doctrine-tracking.md](systems/doctrine-tracking.md).

### PWA / fullscreen
Mobile fullscreen via **PWA** (`manifest.json`, `"display": "standalone"` + iOS meta tags). Add-to-home-screen launches with no browser chrome. Chosen over the Fullscreen API (blocked on iOS Safari for non-video elements). See [technical/stack-and-deployment.md](technical/stack-and-deployment.md).

## Player Experience

On mobile, a casual player should be able to *just move* and still fight competently (auto-aim carries the skill floor), while a coordinating player can override to prioritize targets (the ceiling co-op demands). The HUD should let a player answer three questions in under a second mid-fight: *Am I dying? Is a teammate down? How close is the Bleed Clock to forcing us out?* Everything else is secondary. The board UI is where the slow, conversational part of the game happens — selecting, reading synergy highlights, arguing about placement.

## Design alignment

The UI enforces **Theology = Player Behavior** by *omission*: hiding the doctrine meter is what keeps belief a felt thing rather than a stat to optimize (anti *generic-RPG-convention*). Auto-aim-with-override serves *co-op as structure* (low floor, high ceiling). The "membranes not boxes" direction makes even the HUD obey *Lore = Mechanics* — the interface is part of the organism.

## Implementation Considerations — current HUD/UI inventory

- **HUD:** Bleed Clock bar (with stage), floor + phase, local HP, teammate HP rows, live enemy count.
- **BoardPanel:** SVG hex grid, owner colors, synergy highlight (CSS `synergy-pulse`), loot-phase visibility, relic detail card (base + synergy text), placement-error feedback.
- **RelicTray:** lists unplaced relics from the current loot pool; selection/deselect; "all relics placed" ready hint.
- **DescendPanel:** loot-phase only; "Descend ↓" / "Extract ↑"; buttons disable on click (anti double-tap).
- **PhaseToast:** transient COMBAT / FLOOR CLEARED / FLOOR N (2.5s auto-dismiss).
- **Lobby/WaitingRoom:** create/join, room code + Copy button, player list, host-only Start Run, solo hint.
- **PostRunScreen:** WIPED/EXTRACTED, final floor, enemies-killed stat, return-to-lobby.
- **Linked Fates revive UI:** downed-teammate panel, two-step revive (select source relic → downed player's empty slot).

**Binding rule for agents:** the client renders server deltas only; UI never computes game state (no client-side synergy, no client-side doctrine). See [technical/netcode.md](technical/netcode.md).

## Future Expansion

- Implement the **"membranes not boxes"** visual language (draft below): blood-flow health bars, vein-line synergy links between portraits.
- **Ping/wheel comms** for co-op coordination without voice (supports forced communication on mobile).
- **Accessibility**: colorblind-safe owner colors, scalable HUD, reduced-motion mode for the breathing/pulsing effects.
- Gamepad support; right-stick aim parity across platforms.

---

## Draft / Exploratory — UI visual direction

> Mined from `GPT_CHAT_HISTORY.txt`. Aspirational; the implemented inventory above is current reality.

> Don't make boxes. Make **membranes**.

- **Health bars:** not flat fills — a fill with a *flowing blood animation* beneath it.
- **Synergy links:** vein lines drawn between portraits, pulsing when activated.
