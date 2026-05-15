/** Max decoded font bytes per file (client + API hint). */
export const MAX_PUBLISHER_FONT_BYTES = 2 * 1024 * 1024;

export const PUBLISHER_FONT_MIME_ACCEPT =
  'font/woff2,font/woff,font/ttf,font/otf,.woff2,.woff,.ttf,.otf';

/** Persisted publisher font templates (localStorage). */
export const PUBLISHER_FONT_TEMPLATES_STORAGE_KEY = 'openmaic_publisher_font_templates_v1';

/** Session: font template ids selected for the next generation run (sessionStorage). */
export const PUBLISHER_FONTS_SESSION_KEY = 'openmaic_publisher_fonts_session_v1';

export const MAX_PUBLISHER_FONT_TEMPLATES = 8;
