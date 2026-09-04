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

-- Suivi de présence : le coiffeur valide, une fois le rendez-vous passé, si le client est
-- venu ou pas — voir salon-odette-coiffeur.js. 'pending' = pas encore validé (par défaut,
-- y compris pour les RDV à venir). Un no_show est exclu du chiffre d'affaires estimé et
-- des statistiques de prestations les plus demandées (voir renderDashboard côté coiffeur).
alter table public.bookings add column if not exists status text not null default 'pending';
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (status in ('pending', 'attended', 'no_show'));

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

-- Un coiffeur peut aussi modifier ses propres rendez-vous assignés (pour valider le statut
-- venu/absent) — en plus d'un client qui modifie toujours les siens (reprogrammation).
drop policy if exists "bookings_update_own" on public.bookings;
create policy "bookings_update_own" on public.bookings
  for update using (
    auth.uid() = user_id
    or exists (select 1 from public.staff where staff.id = auth.uid() and staff.nom = bookings.coiffeur)
  )
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.staff where staff.id = auth.uid() and staff.nom = bookings.coiffeur)
  );

-- Un coiffeur peut aussi annuler (supprimer) ses propres rendez-vous assignés — en plus
-- d'un client qui annule toujours les siens.
drop policy if exists "bookings_delete_own" on public.bookings;
create policy "bookings_delete_own" on public.bookings
  for delete using (
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

-- ============================================================================
-- Absences des coiffeurs (congés, maladie, formation, imprévu...)
-- ============================================================================
-- Une ligne = un coiffeur indisponible soit toute une journée (heure = 'journee',
-- la valeur par défaut), soit un seul créneau précis ce jour-là (heure = '9h00',
-- '14h00', etc. — même valeurs que HEURES côté JS). `motif` reste privé (voir la
-- vue publique plus bas qui ne l'expose jamais).
create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  coiffeur text not null check (coiffeur in ('Odette', 'Karim', 'Lina')),
  date date not null,
  motif text,
  created_at timestamptz not null default now(),
  unique (coiffeur, date)
);

alter table public.absences add column if not exists heure text not null default 'journee';
alter table public.absences drop constraint if exists absences_heure_check;
alter table public.absences add constraint absences_heure_check
  check (heure in ('journee', '9h00', '10h00', '11h00', '14h00', '15h00', '16h00', '17h00'));

-- Remplace l'ancienne contrainte "un coiffeur, une date" par "un coiffeur, une date, un
-- créneau (ou 'journee')" — permet plusieurs absences le même jour si ce sont des
-- créneaux différents (mais toujours une seule absence "journee" par jour).
alter table public.absences drop constraint if exists absences_coiffeur_date_key;
alter table public.absences drop constraint if exists absences_coiffeur_date_heure_key;
alter table public.absences add constraint absences_coiffeur_date_heure_key unique (coiffeur, date, heure);

alter table public.absences enable row level security;

-- Un coiffeur ne gère (voit/crée/supprime) que SES PROPRES absences.
drop policy if exists "absences_select_own" on public.absences;
create policy "absences_select_own" on public.absences
  for select using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.nom = absences.coiffeur));

drop policy if exists "absences_insert_own" on public.absences;
create policy "absences_insert_own" on public.absences
  for insert with check (exists (select 1 from public.staff where staff.id = auth.uid() and staff.nom = absences.coiffeur));

drop policy if exists "absences_delete_own" on public.absences;
create policy "absences_delete_own" on public.absences
  for delete using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.nom = absences.coiffeur));

-- Manquait jusqu'ici : le formulaire (salon-odette-coiffeur.js) fait un upsert, pas un
-- simple insert, pour poser une plage horaire sans erreur si elle recoupe une absence déjà
-- posée — sans règle "update", ce recoupement échouait silencieusement côté RLS.
drop policy if exists "absences_update_own" on public.absences;
create policy "absences_update_own" on public.absences
  for update using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.nom = absences.coiffeur))
  with check (exists (select 1 from public.staff where staff.id = auth.uid() and staff.nom = absences.coiffeur));

-- Vue publique : coiffeur + date + heure ('journee' ou un créneau précis), JAMAIS le
-- motif (une raison comme "maladie" reste privée) — sert au calendrier client à fermer
-- la journée entière OU juste ce créneau chez ce coiffeur précis, sans révéler pourquoi.
create or replace view public.absence_days as
  select coiffeur, date, heure from public.absences;

grant select on public.absence_days to anon, authenticated;

-- ============================================================================
-- Historique des annulations (pour les statistiques coiffeur)
-- ============================================================================
-- Annuler un rendez-vous supprime toujours la ligne dans `bookings` (le
-- créneau redevient immédiatement libre) — cette table ne sert qu'à garder une
-- trace du fait qu'une annulation a eu lieu, pour pouvoir la compter plus
-- tard. Pas d'identité client ici, juste ce qui est utile aux statistiques.
create table if not exists public.cancellations (
  id uuid primary key default gen_random_uuid(),
  coiffeur text not null check (coiffeur in ('Odette', 'Karim', 'Lina')),
  prestation text,
  appointment_at timestamptz,
  cancelled_at timestamptz not null default now(),
  cancelled_by uuid references auth.users(id) on delete set null
);

alter table public.cancellations enable row level security;

-- Un client peut enregistrer l'annulation d'un rendez-vous qui était le sien.
drop policy if exists "cancellations_insert_own" on public.cancellations;
create policy "cancellations_insert_own" on public.cancellations
  for insert with check (auth.uid() = cancelled_by);

-- Un coiffeur voit les annulations qui LE concernent (pas celles des autres
-- coiffeurs, et sans savoir quel client a annulé).
drop policy if exists "cancellations_select_staff" on public.cancellations;
create policy "cancellations_select_staff" on public.cancellations
  for select using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.nom = cancellations.coiffeur));

-- ============================================================================
-- Espace propriétaire (Odette voit tout le salon, pas seulement ses propres RDV)
-- ============================================================================
-- Un propriétaire se connecte EXACTEMENT comme n'importe quel coiffeur (même
-- formulaire, même table `staff`) — la seule différence est ce booléen. Pas
-- d'interface pour le régler soi-même pour l'instant : à la main dans Supabase,
-- ex. pour donner les droits à Odette :
--   update public.staff set is_owner = true where nom = 'Odette';
alter table public.staff add column if not exists is_owner boolean not null default false;
update public.staff set is_owner = true where nom = 'Odette';

-- Un propriétaire voit TOUS les rendez-vous du salon, tous coiffeurs confondus
-- (en plus des règles déjà en place : client = les siens, coiffeur = les siens).
drop policy if exists "bookings_select_owner" on public.bookings;
create policy "bookings_select_owner" on public.bookings
  for select using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.is_owner));

-- Un propriétaire voit TOUS les profils clients (prénom/téléphone/email), pas
-- seulement ceux qui ont un rendez-vous avec lui — nécessaire pour la liste
-- complète des clients du salon dans l'espace propriétaire.
drop policy if exists "profiles_select_owner" on public.profiles;
create policy "profiles_select_owner" on public.profiles
  for select using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.is_owner));

-- Un propriétaire voit aussi les annulations de TOUS les coiffeurs (statistiques
-- salon entier), pas seulement les siennes.
drop policy if exists "cancellations_select_owner" on public.cancellations;
create policy "cancellations_select_owner" on public.cancellations
  for select using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.is_owner));

-- Un propriétaire voit aussi les absences de TOUTE l'équipe (onglet "Plannings &
-- organisation" de l'espace propriétaire — planning de n'importe quel coiffeur, y compris
-- le motif de chaque absence, utile pour elle en tant que responsable), pas seulement les
-- siennes.
drop policy if exists "absences_select_owner" on public.absences;
create policy "absences_select_owner" on public.absences
  for select using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.is_owner));

-- Un propriétaire peut aussi CRÉER/MODIFIER/SUPPRIMER une absence pour N'IMPORTE QUEL
-- coiffeur (pas seulement voir) — c'est ce qui lui permet d'attribuer/retirer une semaine
-- de travail à un employé depuis l'onglet "Plannings & organisation", sans que l'employé
-- ait besoin de le faire lui-même.
drop policy if exists "absences_insert_owner" on public.absences;
create policy "absences_insert_owner" on public.absences
  for insert with check (exists (select 1 from public.staff where staff.id = auth.uid() and staff.is_owner));

drop policy if exists "absences_update_owner" on public.absences;
create policy "absences_update_owner" on public.absences
  for update using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.is_owner))
  with check (exists (select 1 from public.staff where staff.id = auth.uid() and staff.is_owner));

drop policy if exists "absences_delete_owner" on public.absences;
create policy "absences_delete_owner" on public.absences
  for delete using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.is_owner));

-- ============================================================================
-- Emploi du temps récurrent (onglet "Horaires" de l'espace propriétaire)
-- ============================================================================
-- Une ligne = ce coiffeur ne travaille PAS ce jour de la semaine, comme règle
-- permanente (jour_semaine suit la même convention que Date.getDay() en JS :
-- 0 = dimanche, 1 = lundi, ..., 6 = samedi ; dimanche/lundi sont de toute
-- façon fermés partout, seuls 2 à 6 — mardi à samedi — ont un sens ici).
-- PAS de ligne = travaille normalement ce jour-là (même logique que les
-- autres tables du site : on ne stocke que les exceptions au cas par défaut,
-- voir `absences`/`cancellations`). Différent de `absences` qui reste pour
-- les exceptions PONCTUELLES (congés d'UNE semaine précise, maladie...) —
-- les deux mécanismes se cumulent : le calendrier client ferme un jour chez
-- un coiffeur soit parce que c'est son jour de repos habituel (ici), soit à
-- cause d'une absence ponctuelle ce jour précis (`absences`), sans lui
-- révéler laquelle des deux raisons s'applique.
create table if not exists public.weekly_day_off (
  id uuid primary key default gen_random_uuid(),
  coiffeur text not null check (coiffeur in ('Odette', 'Karim', 'Lina')),
  jour_semaine int not null check (jour_semaine between 0 and 6),
  created_at timestamptz not null default now(),
  unique (coiffeur, jour_semaine)
);

alter table public.weekly_day_off enable row level security;

-- Info publique (savoir quels jours un coiffeur travaille normalement est nécessaire au
-- calendrier client, comme booked_slots/absence_days) — tout le monde peut lire.
drop policy if exists "weekly_day_off_select_public" on public.weekly_day_off;
create policy "weekly_day_off_select_public" on public.weekly_day_off
  for select using (true);

-- Seul un propriétaire peut créer/supprimer un jour de repos récurrent (pas de colonne à
-- modifier : soit la ligne existe, soit elle n'existe pas — "for all" couvre insert et
-- delete d'un coup, en plus du select déjà ouvert au public ci-dessus).
drop policy if exists "weekly_day_off_write_owner" on public.weekly_day_off;
create policy "weekly_day_off_write_owner" on public.weekly_day_off
  for all using (exists (select 1 from public.staff where staff.id = auth.uid() and staff.is_owner))
  with check (exists (select 1 from public.staff where staff.id = auth.uid() and staff.is_owner));
