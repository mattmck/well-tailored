# Structured Editor: Source/Result Mode + Collapse Indicators

## Problem

The structured editor only operates on the source resume. After AI tailoring, the final output is read-only — you can't make post-tailoring tweaks without re-running the pipeline. Additionally, collapse/expand indicators on panels and doc cards are too subtle.

## Design

### Structured Editor: Source/Result Toggle

**Auto-switching (Option B):**
- Opens in **Source** mode when no result exists
- After tailoring completes, auto-switches to **Result** mode next time the editor opens
- Manual toggle always available

**Side panel header layout:**
```text
[Source | Result]  [Edit | Preview]  [x]
```

**Source mode** (existing behavior):
- Bidirectional sync with `els.resume` textarea
- Changes flow: structured editor <-> resume textarea

**Result mode** (new):
- Loads from `state.lastResult.output.resume`
- On each structured editor change:
  1. Update `state.lastResult.output.resume` with new markdown
  2. Re-render result preview iframe via `updatePreviewTheme()`
  3. Update the markdown `<pre>` in the Results panel
  4. Update the active `jobResults` version entry so edits persist through save/load
- Result toggle pill disabled when no result exists

**State additions:**
- `state.structuredEditorTarget`: `'source' | 'result'` (default: `'source'`)

**Sync function changes:**
- `syncResumeEditor()` checks `state.structuredEditorTarget` to decide which markdown to send
- `resume-editor-change` handler checks target to decide where to write back

### Collapse/Expand Indicators

Make chevrons on panels and doc cards more visually prominent:
- Larger chevron size (14px -> 18px for panels, 12px -> 16px for doc cards)
- Use a filled triangle character or CSS arrow with better contrast
- Add a subtle background pill/badge around the chevron
- Animate rotation smoothly on toggle
- Consider adding "(click to expand)" helper text on collapsed panels on first visit
