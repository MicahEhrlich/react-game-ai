# Rosh HaShana icons

Transparent derivatives of the user-provided `Gemini_Generated_Image_rosh_hashana.jpeg`
from Downloads. Extracted with the built-in image-generation tool on 2026-09-13;
the original JPEG is unchanged.

- `apple.png`: seasonal apple collectible.
- `honey.png`: seasonal honey collectible.
- `pomegranate.png`: seasonal platformer hazard and runner obstacle.

The boot scene preloads these bundled assets. The seasonal atlas draws them into
its existing 16×16 frames with image smoothing disabled, retaining existing sprite
and collision dimensions. Other themes continue using their own artwork. If an
image fails to load, the seasonal ASCII sprite remains the fallback.

## Extraction prompts

Each icon used the same source JPEG as the edit target and the following prompt,
with `SUBJECT` replaced by the corresponding text below:

> Use case: background-extraction. Edit target: the provided local image. Extract ONLY the SUBJECT. Asset type: transparent game sprite. Preserve its exact chunky pixel-art design, colors, silhouette and interior details. Remove all background and grid lines and all other icons. Center the complete isolated icon in a square canvas, with a small transparent margin, filling about 85% of the canvas height. Real alpha transparency, no shadows, no checkerboard, no text, no added details. Crisp square pixel edges.

- Apple: `apple (left icon: red apple with black outline, brown stem and green leaf)`
- Honey: `honey (middle icon: golden honey jar with bee label and wooden dipper on its right)`
- Pomegranate: `pomegranate (right icon: red cut pomegranate with crown and dark red seeds)`
