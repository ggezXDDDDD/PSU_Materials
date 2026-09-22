# Supplied mascot assets — prototype integration

The source artwork currently lives in the user's untracked `แมว/` folder:

- `รูปภาพ Codex 21 ก.ย. 2569 16_52_48.png` — UI pose and expression sheet (used).
- `รูปภาพ Codex 21 ก.ย. 2569 16_50_37.png` — character reference sheet (reference only).

Originals are not modified or moved. The prototype references the first filename
through a URL-encoded path, and crops its welcome/relaxing poses using an overflow
container. This is a review preview, not transparent production-ready artwork.
The same image response is reused for both slots.

Before migration, export approved poses as individual transparent PNG/WebP files,
keeping the same white cat, aqua visor, pink ears/paws and PSU backpack. Needed first:
welcome, relaxing/empty, searching, success and error. Do not fabricate missing poses
with CSS. Proposed future files are intentionally not referenced until they exist.

The `.ag-mascot` container and `data-pose` convention reserve layout independently
of the artwork. Replace `.ag-mascot-sheet` with a normal fitted image once exported;
remove sheet offsets/masking at that point. Keep the accessible label and image-error
fallback. Do not hardcode the conceptual character name into user-facing controls.

The full sheet is 2,146,805 bytes. This is the largest prototype payload and must be
optimized before Home migration; CSS cropping does not reduce network download size.

## Home production asset (Phase 2)

`mascot-welcome.webp` is the standalone transparent welcome pose used by Home.
1254 × 1254 pixels, real alpha, lossless WebP, 894,562 bytes. The original sheet
remains untouched and is not loaded on Home. This saves about 58% compared with
the sheet but is still the largest new Home asset; do not preload additional poses.
Other poses remain deferred, not fabricated. Home keeps its caption and layout if
the image fails. It has no animation loop.

Generated with imagegen from the supplied `16_52_48` sheet, then format-converted
without resizing or restyling. Original generated PNG is retained outside the repo.
Prompt used:

> Use case: background-extraction. Edit target: the provided mascot reference sheet.
> Extract ONLY the large welcoming floating white cat from the LEFT side of this
> sheet as a single standalone web hero mascot on a genuinely transparent alpha
> background. Preserve the existing character identity, cute closed smiling eyes,
> open happy mouth, chibi proportions, white fur, pink inner ears and paw pads,
> transparent blue visor and dark navy PSU backpack. Keep the full cat and tail
> visible, the little aqua crystal and its immediate small water loop if present.
> Remove all sheet background, labels, titles, UI cards, other cat poses, surrounding
> artwork and all text outside the backpack. No added objects, no redesign, no opaque
> backdrop, no white halo. Center the isolated cat with modest clear margin. This is
> a compact web asset, aim for 512 by 512 pixels if possible. Preserve crisp clean
> edges and real transparency for both light and dark web backgrounds.

The generator returned 1254px rather than the requested 512px; no smaller-size or
real-device performance claim is made.
