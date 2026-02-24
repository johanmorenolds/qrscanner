# QRScanner Web App

Aplicación web para leer códigos QR y códigos de barras con la cámara del dispositivo, guardar lecturas en una tabla local y exportarlas a CSV.

## Funcionalidades

- Escaneo en tiempo real de QR y códigos de barra comunes.
- Selección de cámara disponible (útil para frontal/trasera en celular).
- Persistencia local con IndexedDB (los datos sobreviven recargas del navegador).
- Tabla con búsqueda, borrado individual y vaciado total.
- Exportación de lecturas a CSV.
- Registro manual de códigos como respaldo.
- Pruebas unitarias de utilidades críticas (deduplicación y CSV).

## Stack

- React + TypeScript + Vite
- `@zxing/browser` para lectura QR/barcode
- `idb` para almacenamiento local robusto
- Vitest para pruebas

## Requisitos

- Node.js 20+
- npm

## Instalación

```bash
npm install
```

## Ejecutar local

```bash
npm run dev
```

Se levanta en `http://localhost:5173`.

## Ejecutar desde celular

### Opción A (misma red WiFi)

```bash
npm run dev:phone
```

Luego abre en tu teléfono: `http://IP_DE_TU_PC:5173`.

Nota importante: algunos navegadores móviles exigen HTTPS para acceder a cámara en URLs de red local. Si la cámara no abre, usa la Opción B.

### Opción B (recomendada para cámara en móvil): HTTPS público

Publica en GitHub Pages, Vercel o Netlify para usar HTTPS. Con HTTPS la cámara funciona de forma consistente en móvil.

## Calidad y validación

```bash
npm run test
npm run build
npm run lint
```

## Estructura principal

- `src/hooks/useBarcodeScanner.ts`: control de cámara y decodificación.
- `src/lib/storage.ts`: capa de IndexedDB.
- `src/lib/scans.ts`: deduplicación, formato fecha y exportación CSV.
- `src/App.tsx`: UI principal y tabla de registros.

## Flujo de Git recomendado para rollback

```bash
git log --oneline
git checkout <commit>
# o para volver a main:
git checkout main
```

Para deshacer el último commit sin perder historial, usa:

```bash
git revert <commit>
```
