-- Schéma Supabase pour salon-odette-demo.html (compte client réel)
-- Projet Supabase : https://vyqbbqeskzyromoyxrff.supabase.co (org "ProjetMaxdeMoula", plan Free)
-- A exécuter dans SQL Editor. Idempotent (peut être relancé sans erreur).

-- Profils clients (liés au compte Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  prenom text not null,
  telephone text not null,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Rendez-vous
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  prestation text not null,
  created_at timestamptz not null default now()
);

-- Vraie date/heure du rendez-vous (en plus du texte affiché dans label) — nécessaire
-- pour savoir si un RDV est passé ou à venir (historique côté espace client). Les
-- anciennes lignes créées avant cette colonne restent à null ; le site les traite
-- comme "à venir" par défaut (voir salon-odette-client.js).
alter table public.bookings add column if not exists appointment_at timestamptz;

-- Coiffeur choisi pour le rendez-vous. Liste fixe pour l'instant (pas de table dédiée) :
-- il n'y a pas encore d'espace propriétaire pour gérer l'équipe (ajouter/retirer un
-- coiffeur) — quand ce sera fait, cette colonne texte deviendra une vraie clé étrangère
-- vers une table `coiffeurs`. Nullable pour ne pas casser les RDV de test créés avant
-- cette colonne (le site les traite comme "coiffeur non précisé", voir salon-odette-client.js).
alter table public.bookings add column if not exists coiffeur text;
alter table public.bookings drop constraint if exists bookings_coiffeur_check;
alter table public.bookings add constraint bookings_coiffeur_check check (coiffeur in ('Odette', 'Karim', 'Lina'));

alter table public.bookings enable row level security;

drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own" on public.bookings
  for select using (auth.uid() = user_id);

drop policy if exists "bookings_insert_own" on public.bookings;
create policy "bookings_insert_own" on public.bookings
  for insert with check (auth.uid() = user_id);

drop policy if exists "bookings_delete_own" on public.bookings;
create policy "bookings_delete_own" on public.bookings
  for delete using (auth.uid() = user_id);

drop policy if exists "bookings_update_own" on public.bookings;
create policy "bookings_update_own" on public.bookings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Empêche deux clients de réserver le MÊME créneau chez le MÊME coiffeur — un créneau
-- pris chez Karim n'empêche plus de prendre ce même horaire chez Lina. Si cette commande
-- échoue avec "duplicate key", c'est qu'il existe déjà deux RDV de test avec le même
-- libellé ET le même coiffeur en base — supprime le doublon dans Table Editor puis relance.
alter table public.bookings drop constraint if exists bookings_label_unique;
alter table public.bookings drop constraint if exists bookings_label_coiffeur_unique;
alter table public.bookings add constraint bookings_label_coiffeur_unique unique (label, coiffeur);

-- Trigger : copie automatiquement prenom/telephone (passés en métadonnées à l'inscription)
-- dans profiles dès que le compte auth.users est créé — fonctionne même si la confirmation
-- email est activée, puisqu'il se déclenche à la création du compte, pas à la connexion.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, prenom, telephone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    coalesce(new.raw_user_meta_data->>'telephone', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Vue publique "créneaux pris" : n'expose QUE le texte du créneau (label) et le coiffeur
-- concerné, rien d'autre (ni qui a réservé, ni la prestation) — sert uniquement à griser
-- un créneau déjà pris CHEZ CE COIFFEUR pour tout le monde, sans toucher à la
-- confidentialité des RDV eux-mêmes (bookings reste protégé par RLS, chacun ne voit
-- toujours que ses propres rendez-vous en détail).
create or replace view public.booked_slots as
  select label, coiffeur from public.bookings;

grant select on public.booked_slots to anon, authenticated;

-- ============================================================================
-- Espace coiffeur (salon-odette-espace-coiffeur.html)
-- ============================================================================
-- Table qui relie un compte Supabase (auth.users) à un nom de coiffeur.
-- Pas encore d'interface pour gérer l'équipe soi-même : pour créer un compte
-- coiffeur, va dans Authentication → Users → Add user (coche "Auto Confirm
-- User" pour éviter l'email de confirmation), puis exécute :
--   insert into public.staff (id, nom) values ('<uid du compte créé>', 'Karim');
create table if not exists public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null check (nom in ('Odette', 'Karim', 'Lina')),
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

drop policy if exists "staff_select_own" on public.staff;
create policy "staff_select_own" on public.staff
  for select using (auth.uid() = id);

-- Un coiffeur voit tous les rendez-vous qui lui sont assignés (en plus d'un client, qui
-- continue de ne voir que les siens) — nécessaire pour afficher son emploi du temps.
drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own" on public.bookings
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.staff where staff.id = auth.uid() and staff.nom = bookings.coiffeur)
  );

-- Un coiffeur voit le prénom/téléphone d'un client SEULEMENT si ce client a un
-- rendez-vous avec lui — pas celui de n'importe quel client du salon.
drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff" on public.profiles
  for select using (
    exists (
      select 1 from public.bookings b
      join public.staff s on s.id = auth.uid()
      where b.user_id = profiles.id and b.coiffeur = s.nom
    )
  );
