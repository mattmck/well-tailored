# Workbench Promo Edit Handoff

## Deliverable
- Format: `16:9`
- Length: `45-60s`
- Style target: cinematic product promo built from still screenshots
- Edit philosophy: directional camera movement, shallow pull-outs, contextual reveals

## Sequence Overview

| Scene | Time | Editorial job | Primary asset |
| --- | --- | --- | --- |
| 1 | `0:00-0:05` | Hook with detail | Results close-up |
| 2 | `0:05-0:10` | Reveal panel context | Results section wide |
| 3 | `0:10-0:16` | Connect inputs to outputs | Full workbench |
| 4 | `0:16-0:22` | Show intake realism | Huntr/source shot |
| 5 | `0:22-0:29` | Show control | Prompt/provider shot |
| 6 | `0:29-0:35` | Show visual tuning | Appearance + preview |
| 7 | `0:35-0:44` | Show payoff | Results hero shot |
| 8 | `0:44-0:51` | Show whole system | Widest full workbench |
| 9 | `0:51-0:56` | Show handoff | Export shot |
| 10 | `0:56-1:00` | Close | Branded end card |

## Motion Spec

### Universal settings
- Ease: soft ease in/out, no harsh bezier spikes
- Screenshot scale range: `100% -> 114%`
- Rotation range: `0deg -> 6deg`
- Position drift: `20-90px` over a shot, depending on crop
- Blur: only for transitions and depth separation, not as a constant look
- Shadow: soft, large-radius, low-opacity; more like product lighting than card UI

### Depth stack
For hero shots, break the screenshot into:

1. Background glow or matte
2. Main app surface
3. Highlight card or result area
4. Annotation/copy layer

This is what creates the Codex-like pull-through feeling.

## Scene-by-Scene Instructions

### Scene 1
- Asset: strongest results close-up
- Crop: tight on score or rendered preview detail
- Motion:
  - Start at `110-114%`
  - Slow push to `116%`
  - Drift down-right slightly
- Rotation: `4deg`
- Overlay copy: `Tailor. Score. Ship.`
- Transition out: cross-dissolve into a wider version of the same screenshot

### Scene 2
- Asset: wider results screenshot
- Crop: reveal surrounding notes/tabs
- Motion:
  - Pull back from `116%` to `101-103%`
  - Reduce rotation from `4deg` to `1deg`
- Overlay copy: `One workbench, not five tabs.`
- Transition out: directional move left to begin connecting the rest of the app

### Scene 3
- Asset: full workbench screenshot
- Crop: start centered between results and inputs
- Motion:
  - Horizontal glide left across the UI
  - Slight zoom out during the move
  - Use parallax if cards are masked separately
- Overlay copy: `Local docs. Huntr roles. Manual briefs.`
- Important: this is the first "wider connection" pull-out, so let the viewer feel the system opening up

### Scene 4
- Asset: source/Huntr screenshot
- Crop: selected role plus populated fields
- Motion:
  - Quick ease-in push on selected job
  - Settle and hold
- Overlay copy: `Bring the role in fast.`
- Optional annotation callouts:
  - `Wishlist role`
  - `Autofilled details`

### Scene 5
- Asset: prompt/provider screenshot
- Crop: tabs and selectors
- Motion:
  - Lateral drift right
  - Finish with a subtle push into the active prompt tab
- Overlay copy: `Adjust the run before it runs.`
- Optional annotation callouts:
  - `Tailoring model`
  - `Scoring model`
  - `Prompt tabs`

### Scene 6
- Asset: appearance controls and preview
- Crop: controls in foreground, preview behind or adjacent
- Motion:
  - Simulate a focus shift from controls to preview
  - Slight zoom out to make both readable
- Overlay copy: `Tune the output, not just the prompt.`
- Transition out: brighten the preview region first, then carry that into results

### Scene 7
- Asset: results hero screenshot
- Crop: scorecards plus preview
- Motion:
  - Fastest push of the reel, but still smooth
  - Land on overall fit
  - Then short lateral drift to grouped notes
- Overlay copy: `Fit. Risk. Findings. Preview.`
- Optional callouts:
  - `Overall fit`
  - `ATS score`
  - `Reviewer notes`

### Scene 8
- Asset: widest clean full-workbench shot
- Crop: full frame
- Motion:
  - Pull out farther than any previous shot
  - Add very light upward drift after the pull-out
- Overlay copy: `Ingest. Direct. Evaluate. Export.`
- Note: this is the most important structural shot in the piece

### Scene 9
- Asset: export button shot
- Crop: resume/cover export controls with preview visible
- Motion:
  - Push in on export actions
  - Minor parallax between buttons and preview
- Overlay copy: `Markdown. HTML. PDF.`
- Optional click accent:
  - short light pulse on PDF/HTML buttons

### Scene 10
- Asset: best wide shot or custom branded card
- Motion:
  - Nearly static
  - Tiny ambient drift only
- Overlay copy:
  - `Well-Tailored workbench`
  - `A sharper application loop`
- End behavior:
  - fade to black or loop back to Scene 1 close-up

## Text Treatment
- Use short fragments only.
- Keep all caps limited to tiny labels.
- Prefer one statement per scene.
- Suggested text style:
  - Primary line: large serif or high-contrast display face
  - Secondary line: clean sans, small, tracked out slightly

## Transitions
- Prefer:
  - cross-dissolves
  - masked push-throughs
  - directional blur under 8 frames
  - scale-matched pull-backs
- Avoid:
  - whip pans
  - glitch effects
  - aggressive motion blur
  - anything that makes static screenshots feel fake

## Sound Notes
- Music should be restrained and modern, not trailer-heavy.
- Build energy across Scenes `1-7`.
- Let Scene `8` breathe during the wide pull-out.
- Add subtle UI-adjacent accents only if tasteful:
  - soft rise on pull-outs
  - quiet tick or bloom on score reveals
  - gentle lift on export close

## Asset Naming
Recommended filenames for the screenshot pass:

- `workbench-full-wide.png`
- `workbench-results-hero.png`
- `workbench-source-huntr.png`
- `workbench-prompts-controls.png`
- `workbench-appearance-preview.png`
- `workbench-export-actions.png`

## Editor Checklist
- Does the first shot start too close?
- Are pull-outs used only when context needs to widen?
- Is there at least one clean full-system reveal?
- Does each scene answer exactly one product question?
- Is the piece still clear with the sound off?
- Could the viewer describe the workflow after one watch?
