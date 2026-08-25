# TDE — Webflow export

Todo el experience vive en este folder. Para integrarlo en Webflow:

1. Sube ESTE folder completo a cualquier hosting estatico con HTTPS + CORS
   (Cloudflare Pages / Netlify / S3 / GitHub Pages). Ej: https://cdn.tde.do/tde/
2. En Webflow, pagina "TDE Experience" (ya creada en el site TDE Web):
   Page settings -> Custom code -> Inside <head>:

   <script defer data-base="https://TU-CDN/tde/" src="https://TU-CDN/tde/tde-loader.js"></script>

   (sustituye TU-CDN por el dominio real; la barra final del data-base importa)
3. Publica. La pagina Webflow queda vacia de elementos: el loader inyecta
   DOM + CSS + three.js + assets y monta la experiencia completa.

Notas:
- El formulario de contacto es front-only; en Webflow puedes sustituirlo por
  un Form nativo mas adelante.
- Los videos pesan (~30MB total): usa un CDN con cache.
