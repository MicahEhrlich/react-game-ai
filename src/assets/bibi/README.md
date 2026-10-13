# Bibi head artwork

`head-reference.png` is an unchanged copy of the supplied
`/Users/micah/Downloads/BibiHeadSmall.png` (1024×559 RGB PNG).

`head-cutout.png` was prepared with the built-in imagegen tool to remove the
baked-in checkerboard and shadow. `head.png` packages its cropped sprite frame,
preserving the cutout's colors and alpha within that frame. `head-mono.png`
derives the black/white version used in the 7.10 mark with the same alpha mask.

Final built-in imagegen prompt:

> Use case: background-extraction. Asset type: exact supplied pixel-art head for a game sprite. Edit target: the supplied PNG. Remove ONLY the baked-in gray checkerboard background and the faint shadow below the head; replace these with actual transparent alpha. Preserve the supplied head artwork, exact facial expression, hair shape, dark navy outline, colors, pixel/block edges and orientation unchanged; do not redraw, reinterpret or add details. Crop tightly to the outside edge of the head with at most 1% transparent padding, keeping full hair, ears and chin. The head should fill the transparent image height. Output one isolated head, no shoulders, no text, no checkerboard.

Regenerate these assets with:

```sh
node --experimental-strip-types scripts/prepare-bibi-head.ts
```

The game scales the source head to 20×25 for ordinary poses and to a compact
10×6 pose when sliding. Mirroring and invulnerability visibility follow the
physics avatar. These are image overlays; the existing collision bodies stay
the same as other themes, including Kirk mode. The aircraft's movement bounds
include the head without enlarging its collision body.
