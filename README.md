# Plantilla Menú Rapi

Plantilla de menú web para restaurantes, **dark + glassmorphism**, estilo app de delivery. Un solo archivo `index.html` con CSS y JS vanilla inline. Sin frameworks, sin build. Desplegable en Cloudflare Pages.

Misma base funcional que `plantilla-catalogo-rapi` (mismo contrato de `config.json` / `productos.json`, drop-in con catalogsync) pero con diseño moderno para demos:

- Tema oscuro con transparencias y glow de color.
- Categorías como **íconos circulares** (emoji auto-asignado según el slug/nombre de la categoría — no requiere assets).
- **Favoritos** funcionales (persisten en `localStorage`, botón ♥ en cada card y en el modal).
- **Barra inferior tipo app**: Inicio · Ofertas · Carrito · Favoritos.
- Carrito como **bottom-sheet** (panel que sube desde el footer) + mini-barra "Ver mi carrito" con total en vivo.
- Modal de producto estilo app: imagen grande + "Personaliza" (variantes) + stepper y botón con precio en vivo.

## Cómo funciona

El backend (craft-crm catalogsync) regenera `productos.json` y la clave `categories` de `config.json`; la plantilla los consume en el navegador vía `fetch`. La plantilla **no modifica** esos archivos, solo los lee.

## `config.json`

Contrato **idéntico** al de `plantilla-catalogo-rapi`. Clave obligatoria escrita por el backend:

| Clave | Tipo | Descripción |
|---|---|---|
| `categories` | `object` | Mapa `slug → nombre visible`. Ej: `{"hamburguesas": "Hamburguesas"}`. |

Claves opcionales (definidas por la plantilla, preservadas por el backend):

| Clave | Tipo | Default | Descripción |
|---|---|---|---|
| `store_name` | `string` | `"Catálogo"` | Nombre del restaurante (brand, footer, title) |
| `site_title` | `string` | `store_name` | `<title>` de la página |
| `hero_title` | `string` (HTML) | frase por defecto | Titular del hero. Admite `<span class="hl">…</span>` para resaltar en degradado. |
| `whatsapp_number` | `string` | — | WhatsApp (solo dígitos) para checkout |
| `whatsapp_message` | `string` | `"¡Hola! Quiero hacer un pedido:"` | Mensaje inicial del chat |
| `currency` | `string` | `"$"` | Símbolo de moneda |
| `theme_primary` | `string` (hex) | `#FF4D3D` | Color principal (degradados, botones) |
| `theme_accent` | `string` (hex) | `#FF9500` | Color de acento (precios, activos) |
| `badge_category` | `string` | — | Slug de categoría destacada (badge en cards) |
| `min_units` | `number` | — | Mínimo de unidades (aviso en hero) |
| `min_days_advance` | `number` | — | Días mínimos de anticipación (aviso en hero) |

## `productos.json`

Array de objetos, contrato idéntico a la plantilla base: `id`, `slug`, `nombre`, `precio` (número o string), `precio_promo`, `categorias` (string[]), `descripcion`, `stock` (`null` sin control, `0` agotado, `1–3` "quedan pocas"), `imagenes` (string[]), `variantes` (`[{name, options}]`, options string o `{label, price}` — el precio de la opción reemplaza al base), `sku`.

## `localStorage`

| Clave | Contenido |
|---|---|
| `menu_cart` | Ítems del carrito |
| `menu_favs` | IDs de productos favoritos |

## Íconos de categoría

Se asignan automáticamente por palabra clave sobre el slug/nombre (hamburguesas 🍔, pizza 🍕, bebidas 🥤, etc.). Fallback: 🍽️. No requiere subir imágenes de categoría. Para agregar mapeos, editar el array `CAT_ICONS` en `index.html`.

## Despliegue en Cloudflare Pages

Proyecto Pages conectado al repo. Framework preset: **None**. Build command: *(vacío)*. Output directory: `/`. El workflow `.github/workflows/deploy.yml` despliega en push a `main` (project name `deli-expressrappi`).
