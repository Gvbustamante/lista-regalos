# PlayTime Manager

Sistema **offline-first** para mini parques infantiles. Registra entradas y pagos, controla el tiempo de cada niño, avisa cuando se vence y muestra quién está dentro y cuánto le queda. Diseñado primero para tablet.

## Funciones (V1)

- Dashboard con tarjetas por niño y colores según el tiempo que le queda: verde (>20 min), amarillo (10–20), naranja (<10), rojo (terminado).
- Nueva entrada: niño, edad, acompañante, teléfono, plan o tiempo personalizado, precio y método de pago. Autocompleta clientes frecuentes.
- Extender tiempo. Cada extensión queda registrada como operación y pago aparte.
- Alertas con sonido y vibración cuando el tiempo está próximo a vencer y cuando termina.
- Historial con filtros: hoy, ayer, semana, mes y rango personalizado.
- Reportes: ingresos, entradas, extensiones, horas vendidas, planes más usados, horas pico y métodos de pago.
- Tarifas configurables. No hay precios fijos en el código.
- Pantalla pública (TV o segunda tablet). Muestra solo **nombre + tiempo restante**:
  - `/pantalla`: en el mismo dispositivo. Funciona sin internet.
  - `/p/<token>`: en otro dispositivo, por enlace o QR. No pide iniciar sesión.
- Modo offline completo, con sincronización automática al volver internet.
- Roles: dueño, administrador y empleado. La seguridad se aplica en la base de datos (RLS).

## Panel de administración de la plataforma (`/admin`)

Solo para las cuentas de `playtime_platform_admins`. Hoy está registrada `gvbustamante02@gmail.com`, y el correo debe estar confirmado.

- **Negocios**: todos los negocios registrados, con buscador y filtros por plan o suspendidos. Por cada uno:
  - niños en el parque;
  - sesiones del mes contra el límite del plan;
  - ventas;
  - cuentas.
- **Detalle de un negocio**:
  - editar sus datos;
  - asignar el plan SaaS y la fecha de vencimiento;
  - notas internas (solo las ve el admin);
  - suspender o reactivar. Un negocio suspendido pierde el acceso a sus datos.
- **Cuentas**: ver las cuentas del negocio, cambiar el rol (dueño, administrador, empleado), quitarlas o agregar una cuenta ya registrada por su correo.
- **Tarifas**: crear y editar las tarifas del negocio. Llegan a sus tablets al sincronizar.
- **Sesiones**: historial del negocio con filtros de fecha.
- **Planes SaaS**: catálogo editable (precio, límite de dispositivos, sesiones por mes, cuentas y funciones) y cuántos negocios tiene cada plan.

Para agregar otra persona administradora:

```sql
insert into public.playtime_platform_admins(email) values ('correo@ejemplo.com');
```

## Planes, límites y extras

Cada negocio principal tiene un plan SaaS con 4 límites:
- entradas por mes;
- cuentas;
- dispositivos;
- sedes.

Sus sedes comparten ese plan. Los límites se editan en `/admin/planes`.

**La app bloquea:**
- **Entradas**: al llegar al límite del mes, el botón "Nueva entrada" se bloquea y aparecen las opciones (renovar, mejorar plan o comprar extra), con enlace a WhatsApp o correo.
- **Plan vencido** (`plan_expires_at`): no se pueden registrar entradas nuevas. Los niños que ya están dentro siguen funcionando.
- **Dispositivos**: cada tablet o celular se registra al iniciar sesión. Si no hay cupo, ese dispositivo queda bloqueado.
- **Cuentas y sedes**: no se pueden agregar más.

**El servidor también bloquea**, con triggers. En las entradas deja un margen de 10 para ventas hechas sin internet.

**Extras**: el admin los agrega en el detalle del negocio, pestaña Extras. Se suman al límite y pueden durar hasta fin de mes, ser permanentes o vencer en una fecha.

**Sedes**: el dueño crea sedes en Ajustes → Sedes y cambia de sede desde el encabezado. Cada sede nueva copia las tarifas y los dueños/administradores del principal.

## Publicar en Vercel

1. En vercel.com → **Add New → Project** → importa `Gvbustamante/lista-regalos`.
2. Framework: **Vite**. Build: `npm run build`. Output: `dist`.
3. Agrega las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`, con los valores de `.env.example`.
4. En **Settings → Git → Production Branch**, pon la rama que quieras publicar (por ejemplo `claude/github-repositories-qpkz0w`, o `main` después de fusionar).
5. En Supabase → Authentication → URL Configuration, agrega el dominio de Vercel en **Redirect URLs**.

## Stack

React + TypeScript + Vite · Tailwind CSS v4 · Dexie (IndexedDB) · Supabase (Auth, Postgres, Realtime) · PWA · Capacitor

## Cómo funciona el tiempo

No se guarda un contador. Se guardan `started_at` y `expires_at`, y el tiempo restante se calcula así: `expires_at - ahora`. Por eso sobrevive a cierres, bloqueos de pantalla y cortes de internet.

## Offline y sincronización

1. Toda escritura va primero a IndexedDB, marcada como pendiente (`_dirty = 1`).
2. **Push**: sube los registros pendientes a Supabase (upsert con UUID generado en el dispositivo).
3. **Pull**: baja los cambios con `synced_at` mayor al último cursor. `synced_at` lo pone el servidor con un trigger.
4. Si hay conflicto, gana el `updated_at` más reciente.
5. La sincronización se dispara:
   - después de cada cambio;
   - cada 30 s;
   - al volver la conexión;
   - por Realtime, cuando otro dispositivo cambia algo.

## Base de datos

Proyecto Supabase **dear-guest-admin**. Todas las tablas usan el prefijo `playtime_` para no mezclarse con las de otros proyectos:

`playtime_businesses` · `playtime_members` · `playtime_children` · `playtime_plans` · `playtime_sessions` · `playtime_extensions` · `playtime_payments`

Funciones RPC:
- `playtime_create_business`: crea el negocio, el dueño y tarifas de ejemplo.
- `playtime_public_board`: datos de la pantalla pública, por token.

La migración está en `supabase/migrations/` y ya está aplicada.

## Desarrollo

```bash
cp .env.example .env
npm install
npm run dev
npm run build
```

## Deploy (Vercel)

- Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` (valores en `.env.example`).
- `vercel.json` ya redirige todas las rutas a la SPA.
- En Supabase → Auth → URL Configuration, agrega el dominio de Vercel en **Redirect URLs** para que funcione el correo de confirmación.

## Android (tablet)

```bash
npm i @capacitor/android
npx cap add android
npm run build && npx cap sync && npx cap open android
```

## Hoja de ruta

- **V2**: recibo/impresión, ficha de clientes frecuentes, más estadísticas.
- **V3**: invitar empleados, múltiples sedes, suscripciones SaaS.
