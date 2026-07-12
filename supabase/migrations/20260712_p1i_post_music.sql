-- =============================================================================
-- P1.i · Música no post (estilo Instagram feed)
-- =============================================================================
-- Coluna JSONB opcional em posts:
-- {
--   "title": "...",
--   "artist": "...",
--   "url": "https://...",
--   "platform": "youtube"|"spotify"|"soundcloud",
--   "thumbnailUrl": "...",
--   "embedUrl": "...",
--   "startAtSec": 12,
--   "clipDurationSec": 30
-- }
-- =============================================================================

alter table public.posts
  add column if not exists music jsonb;

comment on column public.posts.music is
  'Música do post (estilo IG): título, artista, URL, trecho startAtSec + clipDurationSec';
