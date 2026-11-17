-- =====================================================================
-- Taller Mecánico Los Pistoneros - Esquema de base de datos (Supabase)
-- Ejecutar completo en: SQL Editor > New query > Run (una sola vez).
-- Si necesitas reiniciar, ejecuta primero supabase/reset.sql
-- =====================================================================

-- ---------- Tipos ----------
create type rol_usuario as enum ('pendiente','dueno','recepcion','mecanico','administracion');
create type estado_orden as enum ('pendiente_diagnostico','en_reparacion','esperando_repuestos','listo_para_entregar','entregado');
create type estado_notificacion as enum ('preparada','enviada','fallida');

-- ---------- Perfiles (rol de cada usuario; RNF-04) ----------
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol rol_usuario not null default 'pendiente',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Cada usuario nuevo recibe un perfil SIN permisos hasta que el dueño le asigne un rol.
create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'nombre',''), split_part(new.email,'@',1)));
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

-- Rol del usuario conectado (null si está inactivo). security definer evita recursión con RLS.
create function public.mi_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

-- ---------- Tablas del negocio ----------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  telefono text not null unique,            -- CU-01: evita clientes duplicados por teléfono
  email text,
  direccion text,
  created_at timestamptz not null default now()
);

create table public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  patente text not null unique,             -- CU-02: evita vehículos duplicados
  marca text not null,
  modelo text not null,
  anio int check (anio between 1950 and 2100),
  kilometraje int check (kilometraje >= 0),
  created_at timestamptz not null default now()
);

create table public.ordenes_trabajo (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  cliente_id uuid not null references public.clientes(id),   -- RNF-06: toda orden tiene cliente y vehículo
  vehiculo_id uuid not null references public.vehiculos(id),
  mecanico_id uuid references public.perfiles(id),
  estado estado_orden not null default 'pendiente_diagnostico',
  fecha_ingreso timestamptz not null default now(),
  motivo text not null,
  problema_informado text,
  fecha_termino timestamptz,
  fecha_entrega timestamptz,
  creada_por uuid references public.perfiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diagnosticos (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  autor_id uuid references public.perfiles(id) default auth.uid(),
  diagnostico text not null,
  fallas text,
  observaciones text,
  trabajos_recomendados text,
  created_at timestamptz not null default now()
);

create table public.avances (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  autor_id uuid references public.perfiles(id) default auth.uid(),
  descripcion text not null,
  created_at timestamptz not null default now()
);

create table public.repuestos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nombre text not null,
  stock int not null default 0 check (stock >= 0),
  stock_minimo int not null default 0 check (stock_minimo >= 0),
  precio_unitario bigint not null default 0 check (precio_unitario >= 0)
);

create table public.orden_repuestos (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  repuesto_id uuid not null references public.repuestos(id),
  cantidad int not null check (cantidad > 0),
  precio_unitario bigint check (precio_unitario >= 0),
  registrado_por uuid references public.perfiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null unique references public.ordenes_trabajo(id) on delete cascade,
  mano_obra bigint not null default 0 check (mano_obra >= 0),
  costo_repuestos bigint not null default 0 check (costo_repuestos >= 0),
  descuento bigint not null default 0 check (descuento >= 0),
  total bigint generated always as (mano_obra + costo_repuestos - descuento) stored,
  costo_final bigint check (costo_final is null or costo_final >= 0),
  creado_por uuid references public.perfiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (descuento <= mano_obra + costo_repuestos)          -- CU-10: descuento no mayor al total
);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  monto bigint not null check (monto > 0),
  medio text,
  registrado_por uuid references public.perfiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id),
  canal text not null default 'por_definir' check (canal in ('por_definir','whatsapp','sms','correo','otro')),
  mensaje text not null,
  estado estado_notificacion not null default 'preparada',
  creada_por uuid references public.perfiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index on public.vehiculos (cliente_id);
create index on public.ordenes_trabajo (vehiculo_id);
create index on public.ordenes_trabajo (mecanico_id);
create index on public.ordenes_trabajo (estado);
create index on public.orden_repuestos (orden_id);
create index on public.pagos (orden_id);
create index on public.notificaciones (orden_id, created_at desc);
-- CU-15: la notificación siempre corresponde al cliente asociado a la orden.
create function public.validar_notificacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cliente uuid;
begin
  select cliente_id into v_cliente from public.ordenes_trabajo where id = new.orden_id;
  if v_cliente is null then raise exception 'orden_no_registrada'; end if;
  if new.cliente_id is distinct from v_cliente then raise exception 'cliente_no_corresponde_a_orden'; end if;
  return new;
end $$;
create trigger notificaciones_validar before insert or update on public.notificaciones
  for each row execute function public.validar_notificacion();


-- ---------- Reglas de negocio en la base de datos ----------
create function public.tocar_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger ordenes_updated_at before update on public.ordenes_trabajo
  for each row execute function public.tocar_updated_at();

-- ¿La orden está asignada al usuario conectado?
create function public.orden_asignada(p_orden uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ordenes_trabajo where id = p_orden and mecanico_id = auth.uid())
$$;

-- RNF-06: la orden siempre queda ligada al cliente dueño del vehículo.
create function public.validar_orden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select cliente_id into new.cliente_id from public.vehiculos where id = new.vehiculo_id;
  if new.cliente_id is null then raise exception 'vehiculo_no_registrado'; end if;
  return new;
end $$;
create trigger ordenes_validar before insert on public.ordenes_trabajo
  for each row execute function public.validar_orden();

-- Reglas sobre órdenes: solo el dueño asigna mecánicos, el mecánico solo cambia el estado,
-- y la entrega exige que la orden esté "lista para entregar" (CU-05, CU-06, CU-16).
create function public.proteger_orden() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_rol rol_usuario := public.mi_rol();
begin
  if new.mecanico_id is distinct from old.mecanico_id and v_rol is distinct from 'dueno' then
    raise exception 'solo_dueno_asigna_mecanico';
  end if;
  if v_rol = 'recepcion' and new.estado is distinct from old.estado and new.estado <> 'entregado' then
    raise exception 'recepcion_solo_registra_entrega';
  end if;
  if v_rol = 'mecanico' then
    if (to_jsonb(new) - 'estado' - 'updated_at' - 'fecha_termino' - 'fecha_entrega')
       is distinct from (to_jsonb(old) - 'estado' - 'updated_at' - 'fecha_termino' - 'fecha_entrega') then
      raise exception 'mecanico_solo_cambia_estado';
    end if;
    if new.estado = 'entregado' then raise exception 'mecanico_no_entrega_vehiculos'; end if;
  end if;
  if new.estado is distinct from old.estado then
    if new.estado = 'listo_para_entregar' then new.fecha_termino := coalesce(old.fecha_termino, now()); end if;
    if new.estado = 'entregado' then
      if old.estado <> 'listo_para_entregar' then raise exception 'orden_no_lista_para_entrega'; end if;
      new.fecha_entrega := now();
    end if;
  end if;
  return new;
end $$;
create trigger ordenes_proteger before update on public.ordenes_trabajo
  for each row execute function public.proteger_orden();

-- El mecánico solo puede modificar el stock, no precios ni nombres (CU-09).
create function public.proteger_repuesto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.mi_rol() = 'mecanico'
     and (to_jsonb(new) - 'stock') is distinct from (to_jsonb(old) - 'stock') then
    raise exception 'mecanico_solo_cambia_stock';
  end if;
  return new;
end $$;
create trigger repuestos_proteger before update on public.repuestos
  for each row execute function public.proteger_repuesto();

-- Al registrar un repuesto en una orden: valida stock, fija el precio y descuenta (CU-08).
create function public.registrar_repuesto_orden() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_stock int; v_precio bigint;
begin
  select stock, precio_unitario into v_stock, v_precio
    from public.repuestos where id = new.repuesto_id for update;
  if not found then raise exception 'repuesto_no_registrado'; end if;
  if v_stock < new.cantidad then raise exception 'stock_insuficiente'; end if;
  new.precio_unitario := coalesce(new.precio_unitario, v_precio);
  update public.repuestos set stock = stock - new.cantidad where id = new.repuesto_id;
  return new;
end $$;
create trigger orden_repuestos_registrar before insert on public.orden_repuestos
  for each row execute function public.registrar_repuesto_orden();


-- =====================================================================
-- Paso 3: integridad de presupuestos y pagos.
-- Los importes se expresan en pesos chilenos enteros (CLP).
-- El bloqueo de la orden evita que dos pagos simultáneos superen el total.
-- =====================================================================

create or replace function public.validar_presupuesto_vs_pagos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pagado bigint;
  v_total bigint;
begin
  perform 1 from public.ordenes_trabajo where id = new.orden_id for update;
  v_total := new.mano_obra + new.costo_repuestos - new.descuento;

  select coalesce(sum(monto), 0) into v_pagado
  from public.pagos where orden_id = new.orden_id;

  if v_total < v_pagado then
    raise exception 'presupuesto_menor_a_pagos';
  end if;
  return new;
end;
$$;

drop trigger if exists presupuestos_validar_pagos on public.presupuestos;
create trigger presupuestos_validar_pagos
before insert or update on public.presupuestos
for each row execute function public.validar_presupuesto_vs_pagos();

create or replace function public.validar_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_pagado bigint;
begin
  -- Serializa los pagos y los cambios de presupuesto de una misma orden.
  perform 1 from public.ordenes_trabajo where id = new.orden_id for update;

  select total into v_total
  from public.presupuestos
  where orden_id = new.orden_id;

  if not found then
    raise exception 'pago_sin_presupuesto';
  end if;

  select coalesce(sum(monto), 0) into v_pagado
  from public.pagos
  where orden_id = new.orden_id;

  if v_pagado + new.monto > v_total then
    raise exception 'pago_supera_saldo';
  end if;

  return new;
end;
$$;

drop trigger if exists pagos_validar_saldo on public.pagos;
create trigger pagos_validar_saldo
before insert on public.pagos
for each row execute function public.validar_pago();

-- RF-34: solo dueño/administración registra el costo final y después del término.
create function public.proteger_costo_final() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_fecha_termino timestamptz;
begin
  if new.costo_final is distinct from old.costo_final then
    if public.mi_rol() not in ('dueno','administracion') then
      raise exception 'solo_dueno_administracion_costo_final';
    end if;
    if new.costo_final is not null then
      select fecha_termino into v_fecha_termino from public.ordenes_trabajo where id = new.orden_id;
      if v_fecha_termino is null then raise exception 'costo_final_antes_de_termino'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger presupuestos_proteger_costo_final before update on public.presupuestos
  for each row execute function public.proteger_costo_final();

-- Mensajes de error de negocio traducidos en el frontend.

-- ---------- Seguridad a nivel de fila (RLS) por rol ----------
alter table public.perfiles        enable row level security;
alter table public.clientes        enable row level security;
alter table public.vehiculos       enable row level security;
alter table public.ordenes_trabajo enable row level security;
alter table public.diagnosticos    enable row level security;
alter table public.avances         enable row level security;
alter table public.repuestos       enable row level security;
alter table public.orden_repuestos enable row level security;
alter table public.presupuestos    enable row level security;
alter table public.pagos           enable row level security;
alter table public.notificaciones  enable row level security;

-- perfiles: cada uno ve el suyo; solo el dueño ve a todos y cambia roles
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = auth.uid() or public.mi_rol() = 'dueno');
create policy perfiles_update on public.perfiles for update to authenticated
  using (public.mi_rol() = 'dueno') with check (public.mi_rol() = 'dueno');

-- todos los perfiles con sesión ven el nombre de los mecánicos
create policy perfiles_ver_mecanicos on public.perfiles for select to authenticated
  using (rol = 'mecanico' and activo and public.mi_rol() is not null);

-- clientes
create policy clientes_select on public.clientes for select to authenticated
  using (public.mi_rol() in ('dueno','recepcion','administracion'));
create policy clientes_insert on public.clientes for insert to authenticated
  with check (public.mi_rol() in ('dueno','recepcion'));
create policy clientes_update on public.clientes for update to authenticated
  using (public.mi_rol() in ('dueno','recepcion')) with check (public.mi_rol() in ('dueno','recepcion'));

-- vehiculos (el mecánico solo ve los de sus órdenes)
create policy vehiculos_select on public.vehiculos for select to authenticated
  using (public.mi_rol() in ('dueno','recepcion','administracion')
         or (public.mi_rol() = 'mecanico' and exists (
              select 1 from public.ordenes_trabajo o where o.vehiculo_id = vehiculos.id and o.mecanico_id = auth.uid())));
create policy vehiculos_insert on public.vehiculos for insert to authenticated
  with check (public.mi_rol() in ('dueno','recepcion'));
create policy vehiculos_update on public.vehiculos for update to authenticated
  using (public.mi_rol() in ('dueno','recepcion')) with check (public.mi_rol() in ('dueno','recepcion'));

-- ordenes_trabajo
create policy ordenes_select on public.ordenes_trabajo for select to authenticated
  using (public.mi_rol() in ('dueno','recepcion','administracion')
         or (public.mi_rol() = 'mecanico' and mecanico_id = auth.uid()));
create policy ordenes_insert on public.ordenes_trabajo for insert to authenticated
  with check (public.mi_rol() in ('dueno','recepcion')
              and (mecanico_id is null or public.mi_rol() = 'dueno'));
create policy ordenes_update on public.ordenes_trabajo for update to authenticated
  using (public.mi_rol() in ('dueno','recepcion')
         or (public.mi_rol() = 'mecanico' and mecanico_id = auth.uid()))
  with check (public.mi_rol() in ('dueno','recepcion')
         or (public.mi_rol() = 'mecanico' and mecanico_id = auth.uid()));

-- diagnosticos y avances
create policy diagnosticos_select on public.diagnosticos for select to authenticated
  using (public.mi_rol() in ('dueno','recepcion','administracion')
         or (public.mi_rol() = 'mecanico' and public.orden_asignada(orden_id)));
create policy diagnosticos_insert on public.diagnosticos for insert to authenticated
  with check (public.mi_rol() = 'dueno'
              or (public.mi_rol() = 'mecanico' and public.orden_asignada(orden_id)));
create policy avances_select on public.avances for select to authenticated
  using (public.mi_rol() in ('dueno','recepcion','administracion')
         or (public.mi_rol() = 'mecanico' and public.orden_asignada(orden_id)));
create policy avances_insert on public.avances for insert to authenticated
  with check (public.mi_rol() = 'dueno'
              or (public.mi_rol() = 'mecanico' and public.orden_asignada(orden_id)));

-- repuestos (stock)
create policy repuestos_select on public.repuestos for select to authenticated
  using (public.mi_rol() in ('dueno','recepcion','mecanico','administracion'));
create policy repuestos_insert on public.repuestos for insert to authenticated
  with check (public.mi_rol() = 'dueno');
create policy repuestos_update on public.repuestos for update to authenticated
  using (public.mi_rol() in ('dueno','mecanico')) with check (public.mi_rol() in ('dueno','mecanico'));

-- orden_repuestos
create policy orden_repuestos_select on public.orden_repuestos for select to authenticated
  using (public.mi_rol() in ('dueno','recepcion','administracion')
         or (public.mi_rol() = 'mecanico' and public.orden_asignada(orden_id)));
create policy orden_repuestos_insert on public.orden_repuestos for insert to authenticated
  with check (public.mi_rol() = 'dueno'
              or (public.mi_rol() = 'mecanico' and public.orden_asignada(orden_id)));

-- presupuestos
create policy presupuestos_select on public.presupuestos for select to authenticated
  using (public.mi_rol() in ('dueno','recepcion','administracion'));
create policy presupuestos_insert on public.presupuestos for insert to authenticated
  with check (public.mi_rol() in ('dueno','recepcion','administracion'));
create policy presupuestos_update on public.presupuestos for update to authenticated
  using (public.mi_rol() in ('dueno','recepcion','administracion'))
  with check (public.mi_rol() in ('dueno','recepcion','administracion'));

-- pagos: el mecánico y la recepción no tienen acceso
create policy pagos_select on public.pagos for select to authenticated
  using (public.mi_rol() in ('dueno','administracion'));
create policy pagos_insert on public.pagos for insert to authenticated
  with check (public.mi_rol() in ('dueno','administracion'));

-- notificaciones
create policy notificaciones_select on public.notificaciones for select to authenticated
  using (public.mi_rol() in ('dueno','recepcion'));
create policy notificaciones_insert on public.notificaciones for insert to authenticated
  with check (public.mi_rol() in ('dueno','recepcion'));
create policy notificaciones_update on public.notificaciones for update to authenticated
  using (public.mi_rol() in ('dueno','recepcion')) with check (public.mi_rol() in ('dueno','recepcion'));

-- Las funciones auxiliares solo las usan usuarios con sesión
revoke execute on function public.mi_rol() from public, anon;
revoke execute on function public.orden_asignada(uuid) from public, anon;
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.orden_asignada(uuid) to authenticated;

-- Cambios de estado en tiempo real (RNF-07)
alter publication supabase_realtime add table public.ordenes_trabajo;

-- Si ya existían usuarios antes de ejecutar este script, se les crea su perfil (sin permisos).
insert into public.perfiles (id, nombre)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;
