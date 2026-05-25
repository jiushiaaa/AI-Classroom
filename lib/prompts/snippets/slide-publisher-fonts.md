## Publisher-provided typefaces

The publisher selected a **custom webfont** for this generation run. The runtime will load this exact `font-family` token in the player/editor — you **must** use it in slide text JSON so layouts match brand typography. (Additional fonts may exist in the library for manual editing later; only the primary below applies to AI generation.)

**Primary font (use as default on TextElement):** `{{publisherFontsPrimaryFamily}}`

**Full list (CSS `font-family` tokens — copy exactly, character-for-character):**

{{publisherFontsList}}

**Rules**

1. On every new `TextElement`, set `defaultFontName` to the **primary** token above unless the scene outline explicitly requires a neutral/system look.
2. Inline HTML may use `style="font-family: …"` **only** with tokens from the list above (plus safe fallbacks like `, "Microsoft YaHei", sans-serif` if needed).
3. Do not invent unrelated `font-family` names when this block is present.
4. Headings and body text should use the primary font consistently for this run.
