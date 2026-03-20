# Workbench Promo Video Guide

There is no dedicated video-editing skill in this session.

The closest useful skills are:
- `playwright` for screenshot capture
- `speech` if you want me to synthesize the voiceover audio afterward

For the video itself, the practical path is:

1. Capture the screenshots
2. Build a rough animatic from them
3. Polish the final cut in Descript

## Fastest Workflow

### 1. Generate the screenshot pack

```bash
cd /Users/matt.mcknight/well-tailored
npm run shots:workbench -- --headed
```

Outputs land in:

- `/Users/matt.mcknight/well-tailored/output/playwright/workbench-shots`

### 2. Build a rough animatic

This creates a simple timing video from the screenshot pack:

```bash
cd /Users/matt.mcknight/well-tailored
npm run video:promo
```

Output:

- `/Users/matt.mcknight/well-tailored/output/video/workbench-promo-animatic.mp4`

This is not the final cinematic cut. It is a timing/assembly pass so you can:
- sanity-check pacing
- review the shot order
- hand something tangible to an editor

### 3. Open the planning docs

```bash
open /Users/matt.mcknight/well-tailored/docs/workbench-promo-shot-map.md
open /Users/matt.mcknight/well-tailored/docs/workbench-promo-voiceover.md
open /Users/matt.mcknight/well-tailored/docs/workbench-promo-edit-handoff.md
```

## Recommended Final-Cut Workflow: Descript

Descript is a good fit here because their current workflow supports importing local image files into a project, then using them as layers in scenes and timelines. Their docs also say scenes are the building blocks of video, and Smart Transitions can automatically rearrange, zoom, and fade visual elements between scenes. You can also manually edit scene transitions from the timeline or scene thumbnails. Sources:

- [Import and upload files into Descript](https://help.descript.com/hc/en-us/articles/10119645307789-Import-and-upload-files-into-Descript)
- [Supported file types](https://help.descript.com/hc/en-us/articles/10164098416909-Supported-file-types)
- [Smart Transitions](https://help.descript.com/hc/en-us/articles/34011944399629-Smart-Transitions)
- [Edit a scene transition](https://help.descript.com/hc/en-us/articles/10255974053773-Edit-a-scene-transition)

### Descript workflow

1. Create a new video project in Descript.
2. Import the PNG screenshot pack from `output/playwright/workbench-shots/`.
3. Bring the screenshots into scenes in the order from `workbench-promo-shot-map.md`.
4. Use one scene per storyboard beat.
5. Turn on or keep Smart Transitions for the first assembly pass.
6. Replace any transition that feels too busy with a manual `Crossfade`, `Slide`, or `Cut`.
7. For the Codex-like feel, use the screenshot itself as the scene visual and scale/reposition it per scene so each one starts close, then reveals more context.
8. Paste the narration from `workbench-promo-voiceover.md` into your recording workflow, then record or import the audio.
9. Add music quietly under the narration.
10. Export an `MP4` when the pacing feels right.

### Descript-specific edit advice

- Let Smart Transitions do the first pass, then simplify.
- Use the shot map so you reuse the strongest screenshots rather than forcing every image into the cut.
- Build the opening with the same screenshot in two scenes at different scales. That is the easiest way to fake the “too close, then pull out” rhythm.
- Reserve the widest shot for Scene `8`, not the opener.
- If Descript’s transitions feel too opinionated, replace them manually and keep the motion simpler.

## Alternate Final-Cut Workflow

### Option A: CapCut or Premiere

Use this if you want the best result.

1. Import the screenshot pack.
2. Build the sequence using `workbench-promo-shot-map.md`.
3. Use the motion language from `workbench-promo-storyboard.md`.
4. Record or generate the narration from `workbench-promo-voiceover.md`.
5. Add subtle music and only minimal sound design.

### Option B: Keynote

Use this if you want something fast and surprisingly good:

1. Set the deck to `1920x1080`.
2. Put one screenshot per slide.
3. Use `Magic Move` between slides.
4. Scale and reposition screenshots per scene.
5. Export to video.

This is a good way to fake those zooms and pull-outs quickly.

## What the Rough Animatic Script Does

The script:
- uses the generated screenshot pack
- maps images to the promo scenes
- creates a simple `16:9` timing cut
- applies hold durations and fade-in/fade-out
- exports a single `.mp4`

## If You Want Narration Audio Too

I can do that next with the `speech` skill.

That would give you:
- a spoken `.mp3` or `.wav`
- matched to the voiceover script
- ready to drop under the edit

## Minimum Commands

If you want the shortest possible sequence:

```bash
cd /Users/matt.mcknight/well-tailored
npm run shots:workbench -- --headed
npm run video:promo
open /Users/matt.mcknight/well-tailored/output/video/workbench-promo-animatic.mp4
```
