# Taller Mecánico Los Pistoneros: sistema de órdenes de trabajo

MVP web para gestionar clientes, vehículos y órdenes de trabajo. Stack: React + JavaScript, Vite,
Supabase (PostgreSQL y autenticación), Git/GitHub y Vercel.

## Avance

| Etapa | Estado |
| --- | --- |
| 1. Base de datos, autenticación y roles | Listo |
| 2. Clientes, vehículos y órdenes de trabajo | Listo |
| 3. Repuestos, presupuestos y pagos | Implementado (pendiente de pruebas en Supabase) |
| 4. Reportes, resumen diario y notificaciones | Implementado (pendiente de pruebas en Supabase) |

## Puesta en marcha

1. Crea un proyecto en Supabase.
2. En **SQL Editor** ejecuta `supabase/schema.sql` completo (ya incluye los cambios del paso 2). Opcional: `supabase/seed.sql` para repuestos de ejemplo.
   Si ya habías ejecutado un `schema.sql` anterior, ejecuta las migraciones pendientes en orden: `supabase/migracion_paso2.sql` y `supabase/migracion_paso3.sql`.
3. En **Authentication > Sign In / Providers > Email** desactiva **Confirm email**.
4. En **Authentication > Users > Add user** crea un usuario por cada perfil (marca **Auto Confirm User**), por ejemplo
   `dueno@test.com`, `recepcion@test.com`, `mecanico@test.com` y `admin@test.com`.
5. Convierte al primer usuario en dueño (SQL Editor). Los demás perfiles se asignan después desde la app, en **Usuarios**:

   ```sql
   update public.perfiles set rol = 'dueno'
    where id = (select id from auth.users where email = 'dueno@test.com');
   ```

6. Copia `.env.example` como `.env` y completa la URL y la clave publicable (Project Settings > API Keys).
7. Instala y ejecuta:

   ```bash
   npm install
   npm run dev
   ```

## Cómo probar la etapa 1

1. Ingresa como `dueno@test.com`: ves todos los módulos y la pantalla **Usuarios**.
2. En **Usuarios** asigna Recepción, Mecánico y Administración a las otras cuentas.
3. Cierra sesión e ingresa con cada una: el menú cambia según el perfil.
4. Un usuario sin perfil asignado ve la pantalla "Cuenta pendiente".
5. Escribe en la barra de direcciones `/usuarios` estando como mecánico: te devuelve al inicio.
6. Desactiva una cuenta en **Usuarios**: esa persona ya no puede ingresar.
7. Deja la app 30 minutos sin usar: la sesión se cierra sola.

## Cómo probar la etapa 2

Crea antes las cuentas de los 4 perfiles y asígnalas desde **Usuarios** (como dueño).

1. **Recepción:** en **Clientes** registra un cliente. Intenta registrar otro con el mismo teléfono: el sistema avisa y muestra al existente. Deja el nombre vacío: muestra el error.
2. En **Vehículos** registra un vehículo para ese cliente (patente `ABCD12`). Repite la patente: avisa que ya existe.
3. Pulsa **Nueva orden** en el vehículo, completa el motivo y crea la orden. Queda en "Pendiente de diagnóstico".
4. **Dueño:** abre la orden, asigna al mecánico y pulsa **Guardar asignación**.
5. **Mecánico:** en **Mis trabajos** solo ve la orden asignada. Registra un diagnóstico y un avance y cambia el estado a "En reparación".
6. Con la orden en dos ventanas (dueño y mecánico), cambia el estado: la otra ventana se actualiza sola en pocos segundos.
7. El dueño pasa la orden a "Listo para entregar". La **recepción** pulsa **Registrar entrega** y la orden queda "Entregado" con su fecha.
8. **Restricciones:** el mecánico no ve Clientes ni Vehículos, y la recepción no puede cambiar el estado salvo para registrar la entrega.
9. **Administración** ve clientes, vehículos y órdenes, pero sin botones para editar.

## Seguridad

- Solo se usa la clave publicable. Los permisos los aplican las políticas RLS de `schema.sql`, no el menú.
- Los usuarios nuevos quedan sin permisos hasta que el dueño les asigna un perfil.
- `.env` no se sube a GitHub (está en `.gitignore`).


## Cómo probar la etapa 3

Antes de probar, aplica `supabase/migracion_paso3.sql` en **Supabase > SQL Editor** si tu base de datos ya estaba creada con el esquema anterior. Si creas una base nueva, ejecuta el `supabase/schema.sql` actualizado.

1. **Dueño:** entra a **Repuestos y stock** y registra un repuesto con código, nombre, stock, stock mínimo y precio unitario.
2. Edita el repuesto y comprueba que los cambios se guardan. Deja el stock en el mínimo y verifica que aparece la advertencia **Stock bajo**.
3. **Mecánico:** entra a **Repuestos y stock**. Puede consultar y ajustar existencias, pero no crear repuestos ni modificar sus precios o nombres.
4. Abre una orden asignada al mecánico y registra uno o más repuestos utilizados. Comprueba que la cantidad se descuenta automáticamente del inventario.
5. Intenta registrar una cantidad mayor que el stock disponible: la base de datos debe rechazar la operación y el stock no debe quedar negativo.
6. **Recepción / Administración / Dueño:** entra a **Presupuestos**, elige una orden y registra la mano de obra y el descuento. El costo de repuestos se calcula desde los repuestos asociados a la orden.
7. Comprueba que el total corresponde a mano de obra + repuestos - descuento y que no permite un descuento superior al subtotal.
8. **Administración / Dueño:** entra a **Pagos** y registra un abono. Comprueba que se actualizan el total pagado y el saldo pendiente.
9. Registra otro abono para completar el presupuesto. Verifica que el saldo queda en $0 y que la pantalla indica que está completamente pagado.
10. Intenta registrar un pago superior al saldo o modificar el presupuesto para que su total sea inferior a lo ya pagado. La base de datos debe impedir ambas operaciones.
11. **Permisos:** comprueba que recepción no puede entrar a Pagos y que mecánicos no pueden entrar a Presupuestos ni Pagos, incluso escribiendo las rutas directamente.

### Reglas implementadas en el paso 3

- Los importes se manejan como números enteros en pesos chilenos (CLP).
- Cada presupuesto pertenece a una orden de trabajo y se mantiene un único presupuesto por orden.
- El costo de repuestos se obtiene de los repuestos registrados en la orden, usando el precio unitario guardado al momento de utilizarlos.
- Al registrar un repuesto en una orden, Supabase valida el stock y lo descuenta dentro de la operación.
- No se permiten pagos sin presupuesto ni pagos que superen el saldo pendiente.
- Tampoco se permite reducir el presupuesto por debajo de los pagos que ya fueron registrados.
- El registro de pagos es acumulativo: se pueden registrar abonos hasta completar el total.

Estas validaciones se aplican tanto en la interfaz como en Supabase. Las políticas RLS y los triggers de la base de datos son la protección efectiva; ocultar una pantalla o un botón no sustituye los permisos del servidor.

## Cómo implementar y probar la etapa 4

Si la base de datos ya existe, ejecuta una sola vez `supabase/migracion_paso4.sql` en **Supabase > SQL Editor**. En una instalación nueva, utiliza el `supabase/schema.sql` actualizado.

1. Ingresa como **dueño** y abre **Resumen diario**. Comprueba los contadores de órdenes pendientes de diagnóstico, en reparación, esperando repuestos y listas para entregar. Abre una orden y cambia su estado en otra sesión: el resumen debe actualizarse.
2. Ingresa como **dueño** o **administración** y abre **Reportes**. Selecciona un período y verifica órdenes ingresadas, entregas, pagos registrados, gastos en repuestos, saldos pendientes, motivos frecuentes y gastos por repuesto.
3. En el detalle de costos del reporte, registra el costo final de una reparación que tenga presupuesto y esté en estado listo para entregar o entregado (con fecha de término). Comprueba que queda guardado al recargar. El presupuesto se conserva como costo estimado.
4. Ingresa como **recepción** y abre **Notificaciones**. Selecciona una orden y revisa el contacto del cliente. Prepara un mensaje, copia el texto y guarda el aviso.
5. Envía el mensaje manualmente por el canal disponible (si corresponde) y luego pulsa **Registrar envío**. El sistema solo registra que el usuario confirmó el envío; no se conecta automáticamente a WhatsApp, SMS ni correo.
6. Comprueba los permisos: el resumen diario solo aparece para el dueño; reportes para dueño y administración; notificaciones para dueño y recepción. Intenta acceder a las rutas directamente con otros perfiles.

### Alcance y decisiones del paso 4

- Los reportes utilizan los pagos, presupuestos, órdenes y repuestos efectivamente registrados. Los ingresos son pagos recibidos, no presupuestos emitidos.
- El costo estimado corresponde al total del presupuesto. El costo final se registra manualmente al finalizar el trabajo; se incorpora el campo `costo_final` en presupuestos para no confundir una estimación con un costo real.
- Los gastos calculados corresponden a repuestos utilizados. No se incluyen otros gastos operacionales que el sistema todavía no registra.
- El canal de notificación queda inicialmente como `por_definir`. La aplicación prepara y registra los avisos, pero el envío externo es manual hasta que el taller defina e integre un proveedor.
