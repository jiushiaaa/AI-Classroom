## User-supplied slide background (reference image)

The **first image in the multimodal request** is the publisher’s chosen **full-slide background** (not an inline figure). It should cover the entire canvas behind your layout.

**You MUST follow these rules:**

1. **Do not** output a `background` field in JSON — the system applies this image as the slide background automatically. Omit `background` entirely, or if your template requires it, use `"background": null` (the server will still set the image background).
2. Place **all** didactic content in `elements` only: titles, bullets, shapes, cards, images, etc. Treat the reference image as an **immutable backdrop** (sky, classroom scene, branded wallpaper, etc.).
3. **Contrast & legibility**: Choose text `defaultColor`, shape fills, and card backgrounds so content stays readable on top of the reference (often semi-opaque light panels or dark text on pale overlays work well). Avoid low-contrast text directly on busy regions of the photo.
4. **Do not** add a full-canvas rectangle image that duplicates or obscures the reference background.
5. **Layout**: Respect the usual margins; keep critical text out of decorative corners if the reference has logos or mascots there.
