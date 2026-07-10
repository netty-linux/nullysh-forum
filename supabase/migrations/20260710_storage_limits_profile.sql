-- Aumenta limites de Storage para perfil (avatar/banner).
-- Arquivos grandes são aceitos no cliente e comprimidos antes do upload;
-- o limite do bucket cobre o resultado final + margem (GIF VIP até 15 MB).

update storage.buckets
set
  file_size_limit = 8388608, -- 8 MB (avatar já comprimido ~450 KB)
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'avatars';

update storage.buckets
set
  file_size_limit = 15728640, -- 15 MB (banner estático comprimido ou GIF VIP)
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'banners';

-- Conferência
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('avatars', 'banners', 'emojis', 'posts');
