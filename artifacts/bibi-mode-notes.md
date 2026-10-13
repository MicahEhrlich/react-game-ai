# Bibi mode review

Preview using `?memeMode=adult&meme=bibi-mode`. Locally, add
`&mode=platformer`, `&mode=shooter`, `&mode=runner`, or `&mode=brick` to open a specific mode.
The existing adult-mode acknowledgement remains required.

The active soundtrack is the supplied `/Users/micah/Downloads/bibi_song_short.mp3`,
copied unchanged to `public/audio/music/bibi-mode.mp3`. The production build
includes the same file. It plays at normal speed on repeat through the game's
music output, so existing music volume and pause/resume controls apply. Playback
continues across consecutive Bibi stages and restarts for a new run. A theme
change or quit stops playback, including when the file is still loading.

The clip is approximately 34.56 seconds long. The complete supplied file is used;
there is no further trimming, tempo adjustment, or processing.

`bibi-mode-8bit.wav` and its score/rendering scripts remain as the prior
synthesized audition. They are separate review artifacts, outside the active
runtime soundtrack. `scripts/analyze-bibi-backing.py` documents the earlier
reference-only accompaniment analysis workflow.

`bibi-sprites.png` shows both aircraft directions and the
Bibi character using the supplied BibiHeadSmall.png artwork at 20×25 above its navy suit,
the monochrome portrait, and the new date mark. The date reads `7.1` followed
by Bibi's black-and-white head in place of the zero in `7.10`. The same
mark appears in every mode's scenery and in the mode-change overlay, with a
`7.10` accessible text alternative. The middle row includes native-size previews;
the lower row retains the protesters, bricks, ball, cube, clock and dollar bill.
Regenerate the preview with `npm run render-bibi-sprites`.

The aircraft title `כנף ציון` and court labels `בג״ץ` are drawn separately in the
game so their Hebrew is never mirrored. Court labels use bold 9px Arial rendered
at resolution 3, with a thin dark outline. The aircraft and reference head occupy approximately 48×50, with inset bounds for the rider;
its original 12×8 physics body uses inset world bounds to keep the whole graphic
on screen. Protesters carry symbol-only signs. Brick mode uses normal bricks
and a normal ball; shooter mode uses standard player and enemy shots.

The character keeps the same physics bodies as Kirk mode and the existing foot anchors. Its
head uses a compact 10×6 pose while sliding, within the original eight-pixel visual height. The brick
mode ball renders above the character so the larger portrait cannot obscure it.
The character palette is isolated from other theme sprites.

The head is now an image overlay from `src/assets/bibi/head.png`, prepared
from the supplied BibiHeadSmall.png using an imagegen transparent cutout and
cropped to its sprite frame. The original supplied file is preserved as
`src/assets/bibi/head-reference.png`.
Its monochrome derivative is used in both versions of the date mark. The old
code-drawn portrait is retained only as an asset-load fallback.

Court-cube labels sit above their objects in platformer, shooter, and runner
modes, including the cube stack on runner slide gates. Court text keeps its
Hebrew string in logical order and uses Canvas's normal text origin to avoid
Phaser's high-resolution RTL clipping bug. `06:29` labels retain the original
7px light text, dark outline, and 12px offset above the red clock. Labels follow moving objects
and are destroyed with them. Regular brick-mode targets retain their centered labels.
