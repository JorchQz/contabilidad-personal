# JM Finance 💰

Control de gastos personales — PWA con HTML/CSS/JS + Supabase.

## Setup

### 1. Supabase
1. Ve a tu proyecto en [supabase.com](https://supabase.com)
2. Settings → API → copia la **anon public key**
3. Abre `js/supabase.js` y reemplaza `TU_ANON_KEY_AQUI` con tu key

### 2. Correr localmente
Necesitas un servidor local (no funciona abriendo el HTML directo por las peticiones a Supabase).

Con VS Code: instala la extensión **Live Server** → clic derecho en `index.html` → *Open with Live Server*

O con Python:
```bash
python3 -m http.server 8080
```
Luego abre `http://localhost:8080`

### 3. Deploy (opcional)
Sube los archivos a GitHub Pages, Netlify o Vercel para tenerlo en línea.

## Estructura
```
jm-finance/
├── index.html          # Entry point
├── manifest.json       # PWA manifest
├── css/
│   └── main.css        # Todos los estilos
└── js/
    ├── supabase.js     # Config de Supabase
    ├── router.js       # Navegación entre páginas
    └── app.js          # Lógica principal + onboarding
```

## Módulos actuales
- ✅ Onboarding (nombre, cuentas, deudas, gastos fijos, metas)
- ✅ Dashboard con balance disponible
- ✅ Registro de ingresos
- ✅ Registro de gastos
- ✅ Gestión de deudas con progreso
- ✅ Metas de ahorro
- ✅ Alertas de gastos fijos comprometidos

## Próximos módulos
- [ ] Gráficas por categoría
- [ ] Comparativa mes a mes
- [ ] Transferencias entre cuentas
- [ ] Notificaciones de gastos fijos
- [ ] Modo offline (Service Worker)
