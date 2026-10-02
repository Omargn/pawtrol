-- Demo data for local development and preview branches. Never run against
-- production: these accounts have published passwords.
--
--   demo@pawtrol.dev      / pawtrol-demo   regular user, owns the demo reports
--   moderator@pawtrol.dev / pawtrol-demo   moderator
--
-- 50 reports scattered over central Mexico City so the map isn't empty.
-- Inserted directly (bypassing create_report's rate limit) as the table owner.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('pawtrol-demo', extensions.gen_salt('bf')), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name), now(), now()
from (values
  ('5eed0000-0000-0000-0000-000000000001'::uuid, 'demo@pawtrol.dev', 'Demo Neighbor'),
  ('5eed0000-0000-0000-0000-000000000002'::uuid, 'moderator@pawtrol.dev', 'Demo Moderator')
) as u (id, email, full_name)
on conflict (id) do nothing;

-- GoTrue signs email users in through their identity row.
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.id in ('5eed0000-0000-0000-0000-000000000001', '5eed0000-0000-0000-0000-000000000002')
on conflict (provider_id, provider) do nothing;

insert into private.user_roles (user_id, role)
values ('5eed0000-0000-0000-0000-000000000002', 'moderator')
on conflict do nothing;

-- Deterministic spread within ~6 km of the Zócalo, so every reset looks the same.
insert into public.pet_reports (
  created_by, client_id, kind, species_id, pet_name, description, color, size,
  last_seen_at, location, expires_at, created_at
)
select
  '5eed0000-0000-0000-0000-000000000001',
  ('5eed1000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  case when n % 3 = 0 then 'found' else 'lost' end,
  (array[1, 1, 1, 2, 2, 3, 4, 99])[1 + n % 8]::smallint,
  case when n % 3 = 0 then null
       else (array['Luna', 'Max', 'Kira', 'Rocky', 'Nala', 'Toby', 'Mia', 'Simba', 'Coco', 'Bruno'])[1 + n % 10] end,
  case when n % 3 = 0 then 'Found wandering near the market, friendly and well cared for.'
       else 'Slipped out of the gate in the evening. Very shy, please call out gently.' end,
  (array['black', 'white', 'brown', 'grey', 'orange', 'spotted'])[1 + n % 6],
  (array['small', 'medium', 'large'])[1 + n % 3],
  now() - make_interval(hours => n * 7),
  extensions.st_setsrid(
    extensions.st_makepoint(-99.1332 + 0.055 * sin(n * 2.399), 19.4326 + 0.05 * cos(n * 1.731)),
    4326
  )::extensions.geography,
  now() + interval '30 days' - make_interval(hours => n * 7),
  now() - make_interval(hours => n * 7)
from generate_series(1, 50) as n
on conflict (created_by, client_id) do nothing;
