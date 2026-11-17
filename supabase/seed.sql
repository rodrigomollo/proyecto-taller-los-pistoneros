-- Datos de ejemplo (opcional): repuestos comunes de un taller.
insert into public.repuestos (codigo, nombre, stock, stock_minimo, precio_unitario) values
  ('ACE-5W30', 'Aceite 5W30 (litro)', 40, 10, 6500),
  ('FIL-ACE', 'Filtro de aceite', 15, 5, 4500),
  ('FIL-AIR', 'Filtro de aire', 10, 3, 7800),
  ('PAS-DEL', 'Pastillas de freno delanteras', 8, 3, 28000),
  ('BUJ-STD', 'Bujía estándar', 24, 8, 3900);

-- Convertir a un usuario en dueño (reemplaza el correo). Es necesario para el primer usuario:
-- update public.perfiles set rol = 'dueno'
--  where id = (select id from auth.users where email = 'dueno@test.com');
