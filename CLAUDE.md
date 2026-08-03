# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Plantilla de menú web para restaurantes — dark + glassmorphism, estilo app de delivery. Sin framework, sin build. HTML/CSS/JS vanilla en un único `index.html`.

Hosted en **Cloudflare Pages** (`deli-express`). Deploy automático en push a `main` vía `.github/workflows/deploy.yml`.

## Sin comandos de build

No hay `package.json`, no hay transpilación. Editar `index.html` directamente y hacer push. Para previsualizar localmente:

```bash
python3 -m http.server 8080
# o
npx serve .
```

## Estructura

```
index.html        # Toda la UI, estilos y lógica en un único archivo (~1200 líneas)
config.json       # Config de la tienda (backend escribe categories y claves básicas)
productos.json    # Catálogo de productos (array, generado por craft-crm catalogsync)
producto/[slug]/images/   # Imágenes de productos (no leídas por index.html directamente)
```

El frontend carga `config.json` y `productos.json` vía `fetch` al iniciar. No hay servidor — todo es estático.

## Contrato de datos

### `config.json` — claves relevantes para la plantilla

| Clave | Descripción |
|---|---|
| `categories` | `{ slug: nombre }` — escrito por el backend (catalogsync) |
| `store_name` | Nombre del restaurante |
| `theme_primary` / `theme_accent` | Colores hex; se inyectan como CSS vars `--primary` / `--accent` |
| `whatsapp_number` | Solo dígitos; usado en checkout |
| `badge_category` | Slug de categoría que aparece en badge de cards |
| `catalog_notify_url` + `catalog_notify_token` | Webhook para notificar pedidos (fire-and-forget, opcional) |
| `min_units` / `min_days_advance` | Aviso visible en el hero |

### `productos.json` — campos por producto

`id`, `slug`, `nombre`, `precio` (número), `precio_promo`, `categorias` (string[]), `descripcion`, `stock` (`null`=sin control, `0`=agotado, `1-3`=pocas unidades), `imagenes` (URLs string[]), `variantes` (`[{name, options}]` donde options puede ser string[] o `{label, price}[]`), `sku`.

## Lógica interna en `index.html`

Todo el JS vive en un único `<script>` al final del archivo (~línea 615 en adelante):

- **`CAT_ICONS`** (línea ~640): array de `[keyword, emoji]` para asignar íconos a categorías por coincidencia de palabra clave. Agregar entradas aquí para nuevas categorías.
- **Carrito**: estado en `cartItems[]`, persiste en `localStorage` clave `menu_cart`.
- **Favoritos**: estado en `favs[]`, persiste en `localStorage` clave `menu_favs`.
- **Checkout** (línea ~1026): arma mensaje WhatsApp + dispara webhook `catalog_notify_url` (fire-and-forget).
- **Variantes con precio**: si `options` es `{label, price}`, el precio de la variante reemplaza al precio base del producto.
- **Filtros**: "Todo" / por categoría / `__offers__` / `__location__` / `__favs__`. La vista `__location__` renderiza info de ubicación y reservas desde `config.json`.

## Customización de tema

Los colores se inyectan dinámicamente desde `config.json` al cargar:
```js
document.documentElement.style.setProperty('--primary', config.theme_primary)
document.documentElement.style.setProperty('--accent', config.theme_accent)
```
Modificar `theme_primary` / `theme_accent` en `config.json` es suficiente; no tocar CSS.

## Deploy

```bash
git add index.html config.json  # (o productos.json si cambió)
git commit -m "descripción"
git push   # CI despliega a Cloudflare Pages automáticamente
```

El backend (craft-crm catalogsync) escribe `productos.json` y actualiza `categories` en `config.json` directamente en el repo vía commit automático.
