/*
  ============================================================================
  SALON ODETTE — ESPACE PROPRIÉTAIRE (vue sur tout le salon)
  ============================================================================

  OBJECTIFS DE CE FICHIER
  - Faire tourner la page salon-odette-espace-proprietaire.html : réservée aux
    comptes marqués `staff.is_owner = true` (aujourd'hui : Odette, réglé à la
    main dans Supabase — voir salon-odette-schema.sql).
  - Vérifier que le compte connecté est bien coiffeur (table `staff`) ET
    propriétaire (`is_owner`), avec un message différent dans chaque cas :
    pas coiffeur du tout → "accès non autorisé" ; coiffeur mais pas
    propriétaire → renvoyé vers son espace coiffeur habituel.
  - Donner une vue sur TOUT le salon (pas "mes" données comme sur la page
    coiffeur) : statistiques par coiffeur ou salon entier, tous les clients,
    planning de n'importe quel coiffeur — organisé en 3 onglets.

  NÉ LE 2026-09-04 d'une scission : une première version affichait tout ça en
  bas du tableau de bord personnel de salon-odette-coiffeur.js (sous forme
  d'onglets ajoutés après coup). Séparé en page à part car ça noyait le
  planning perso d'Odette sous les infos de gestion du salon, peu pratique au
  quotidien — Odette utilise l'espace coiffeur pour SON travail, et cette page
  seulement quand elle porte sa casquette de propriétaire.

  CONTRAIREMENT AUX AUTRES FICHIERS DU SITE : cette page ne partage PAS son
  espace global avec les autres — son propre client Supabase, sa propre
  logique, ses propres JOURS/MOIS/HEURES/getMonday/PRESTATION_PRICES
  (mêmes valeurs que salon-odette-coiffeur.js et salon-odette-reservation.js,
  dupliquées volontairement plutôt que partagées).

  CE QUI EST FAIT
  - Connexion email + mot de passe (mêmes comptes Supabase que le reste du
    site) — voir renderLoginForm/checkOwnerAndLoad/showNotStaffMessage/
    showNotOwnerMessage pour les 3 issues possibles (propriétaire → tableau
    de bord ; coiffeur non-propriétaire → lien vers son espace habituel ;
    compte non-coiffeur → lien vers le site public).
  - Onglet Statistiques : mêmes indicateurs que le tableau personnel coiffeur
    (RDV à venir, CA estimé, confirmés/annulés ce mois-ci, prestation la plus
    demandée), avec un sélecteur "Salon entier / Odette / Karim / Lina"
    (ownerStatsScope) pour basculer entre vue globale et un coiffeur précis
    sans changer de compte — calculés par computeOwnerStats(scope).
  - Onglet Clients : tous les clients du salon (prénom, téléphone, email, nb
    de RDV, dernier RDV), avec une recherche simple côté client.
  - Onglet Plannings & organisation : planning hebdomadaire de N'IMPORTE QUEL
    coiffeur choisi (ownerPlanningCoiffeur), même principe visuel que le
    planning personnel de salon-odette-coiffeur.js, avec un bouton pour
    attribuer/retirer la semaine AFFICHÉE à cet employé ("Marquer cette
    semaine comme non travaillée" / "Réactiver la semaine") — pose ou enlève
    une absence "journée" sur chaque jour ouvert (mar-sam) de la semaine, au
    nom de n'importe quel coiffeur. Plus la liste des absences à venir de
    toute l'équipe en dessous (avec le motif, contrairement à ce qu'un
    coiffeur voit des autres normalement).
  Rendu possible par les règles RLS "..._select_owner" (lecture sur bookings/
  profiles/cancellations/absences) et "absences_..._owner" (écriture sur
  absences) dans salon-odette-schema.sql — accès accordé UNIQUEMENT si
  `staff.is_owner` est vrai pour le compte connecté.

  CE QU'IL RESTE À FAIRE / IDÉES POUR LA SUITE
  - Gérer l'équipe depuis une interface (créer un compte coiffeur, cocher
    is_owner) au lieu de le faire à la main dans Supabase.
  - Modifier les tarifs/prestations depuis une interface (PRESTATION_PRICES
    est encore codé en dur ici, comme dans salon-odette-coiffeur.js).
  - Exporter la liste des clients (CSV ou autre).
  - Regrouper visuellement une plage d'absence posée par un coiffeur pour
    lui-même (même limitation que dans salon-odette-coiffeur.js).

  FONCTIONS DE CE FICHIER
  - escapeHtml/toDateKey/formatDateFr/isThisMonth/getMonday : identiques à
    salon-odette-coiffeur.js (dupliquées volontairement, voir plus haut).
  - getWorkingDaysInWeek(weekOffset) : les dates des jours ouverts (mar-sam)
    d'une semaine donnée — sert à savoir quels jours poser/retirer une
    absence "journée" en (dés)attribuant une semaine à un employé.
  - renderLoginForm(errorMsg) : formulaire de connexion ("Connexion
    propriétaire").
  - showNotStaffMessage() : compte pas du tout coiffeur → lien vers le site.
  - showNotOwnerMessage(nom) : coiffeur mais pas propriétaire → lien vers
    salon-odette-espace-coiffeur.html.
  - checkOwnerAndLoad() : vérifie staff + is_owner, dispatch vers l'un des
    trois cas ci-dessus, ou loadOwnerData() si tout est bon.
  - loadOwnerData() : charge en parallèle TOUS les rendez-vous, annulations,
    profils et absences du salon (pas scopés à un coiffeur), construit
    allBookingsForOwnerEnriched (rendez-vous + prénom/téléphone client, pour
    l'onglet Plannings — bookings.user_id référence auth.users, pas profiles,
    donc pas de jointure automatique côté PostgREST, combinée ici à la main),
    puis appelle renderDashboard().
  - renderDashboard() : dessine tout — en-tête ("Bonjour, {nom}" + lien retour
    vers son espace coiffeur), barre d'onglets, contenu de l'onglet actif
    (délégué aux 3 fonctions render...Tab), câble le bouton de déconnexion et
    appelle wireOwnerSection(). Rappelée à chaque interaction (onglet,
    scope, coiffeur, semaine...) — pas de mise à jour partielle du DOM,
    tout est reconstruit depuis l'état à chaque fois.
  - computeOwnerStats(scope) : indicateurs pour 'all' (salon entier) ou un
    coiffeur précis, à partir de allBookingsForOwner/allCancellationsForOwner.
  - renderOwnerStatsTab() / renderOwnerClientsTab() / renderOwnerPlanningTab()
    : construisent le HTML de chaque onglet.
  - buildOwnerCalendarHtml(coiffeurName, weekOffset) : planning hebdomadaire
    (chaîne HTML, pas des nœuds DOM) d'un coiffeur donné.
  - renderOwnerTeamAbsencesHtml() : absences à venir de toute l'équipe.
  - wireOwnerSection(container) : câble tous les clics (onglets, sélecteurs,
    navigation semaine, bouton attribuer/retirer une semaine, recherche
    client) — chacun met à jour une variable d'état puis rappelle
    renderDashboard() (ou loadOwnerData() après une écriture en base, pour
    repartir de données fraîches).

  DÉPEND DE : rien d'autre que la librairie Supabase (chargée par CDN dans
  salon-odette-espace-proprietaire.html) — ce fichier est volontairement
  indépendant du reste du site.
  ============================================================================
*/

var SUPABASE_URL = 'https://vyqbbqeskzyromoyxrff.supabase.co';
var SUPABASE_KEY = 'sb_publishable_zR0jfkgIXbfDrLPLxurx7w_QJIDW1t6';
// persistSession: false — même remarque que dans salon-odette-connexion.js/coiffeur.js.
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Tarifs approximatifs, repris de la page tarifs du site public — sert uniquement à
// estimer un chiffre d'affaires indicatif, pas une vraie facturation.
var PRESTATION_PRICES = {
  'Coupe femme': 48,
  'Coupe homme': 26,
  'Couleur': 68,
  'Balayage / mèches': 85,
  'Coiffage événement': 60,
  'Autre': null
};

// Mêmes constantes que salon-odette-reservation.js/coiffeur.js (fichier volontairement
// indépendant, voir en-tête).
var JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
var HEURES = ['9h00', '10h00', '11h00', '14h00', '15h00', '16h00', '17h00'];
var COIFFEURS = ['Odette', 'Karim', 'Lina'];

var currentSession = null;
var currentStaff = null; // { id, nom, is_owner }

// Vue sur le salon entier (pas "mes" données) — chargées par loadOwnerData().
var allBookingsForOwner = []; // tous les rendez-vous, tous coiffeurs confondus (bruts)
var allBookingsForOwnerEnriched = []; // les mêmes + clientPrenom/clientTelephone (onglet Plannings)
var allAbsencesForOwner = []; // toutes les absences, tous coiffeurs confondus
var allCancellationsForOwner = []; // toutes les annulations, tous coiffeurs confondus
var allClients = []; // tous les profils clients (public.profiles)

// État des onglets/sélecteurs — remis à zéro à la déconnexion.
var ownerActiveTab = 'stats'; // 'stats' | 'clients' | 'planning'
var ownerStatsScope = 'all'; // 'all' (salon entier) ou un nom de coiffeur précis
var ownerPlanningCoiffeur = null; // initialisé au premier rendu (son propre nom par défaut)
var ownerPlanningWeekOffset = 0;

// Incrémenté à chaque connexion/déconnexion — ignore une réponse réseau périmée arrivant
// après qu'une session plus récente a pris le relais (même pattern que salon-odette-coiffeur.js).
var sessionGeneration = 0;

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toDateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDateFr(dateStr) {
  var parts = dateStr.split('-');
  var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
}

// Vrai pour une date (chaîne ISO ou objet Date) tombant dans le mois calendaire en cours.
function isThisMonth(dateVal) {
  if (!dateVal) return false;
  var d = new Date(dateVal);
  var now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function getMonday(date) {
  var d = new Date(date.getTime());
  var day = d.getDay();
  var diff = (day === 0 ? -6 : 1 - day); // recule jusqu'au lundi
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Les dates (objets Date) des jours OUVERTS (mardi à samedi) d'une semaine donnée. Sert à
// savoir sur quels jours poser/retirer une absence "journée" en (dés)attribuant une
// semaine à un employé (voir renderOwnerPlanningTab).
function getWorkingDaysInWeek(weekOffset) {
  var monday = getMonday(new Date());
  var weekStart = new Date(monday.getTime());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  var days = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(weekStart.getTime());
    d.setDate(weekStart.getDate() + i);
    var dow = d.getDay();
    if (dow !== 0 && dow !== 1) days.push(d);
  }
  return days;
}

function renderLoginForm(errorMsg) {
  document.getElementById('dashboardPanel').hidden = true;
  var panel = document.getElementById('loginPanel');
  panel.hidden = false;
  panel.innerHTML =
    '<h3>Connexion propriétaire</h3>' +
    '<p class="account-sub">Réservé au(x) compte(s) propriétaire du salon.</p>' +
    '<div class="field"><label for="sf-email">Email</label><input type="email" id="sf-email" autocomplete="email"></div>' +
    '<div class="field"><label for="sf-pass">Mot de passe</label><input type="password" id="sf-pass" autocomplete="current-password"></div>' +
    '<div class="form-actions"><button type="button" id="sf-loginBtn" class="btn btn-primary">Se connecter</button></div>' +
    '<p id="sf-status" class="login-alert"' + (errorMsg ? '' : ' hidden') + '>' + escapeHtml(errorMsg || '') + '</p>';

  document.getElementById('sf-loginBtn').addEventListener('click', function () {
    var email = document.getElementById('sf-email').value.trim();
    var pass = document.getElementById('sf-pass').value;
    var status = document.getElementById('sf-status');
    if (!email || !pass) {
      status.textContent = 'Entrez votre email et votre mot de passe.';
      status.hidden = false;
      return;
    }
    sessionGeneration++;
    sb.auth.signOut().then(function () {
      var myGeneration = sessionGeneration;
      sb.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
        if (myGeneration !== sessionGeneration) return;
        if (res.error) {
          status.textContent = 'Email ou mot de passe incorrect.';
          status.hidden = false;
          return;
        }
        currentSession = res.data.session;
        checkOwnerAndLoad();
      });
    });
  });
}

function showNotStaffMessage() {
  document.getElementById('dashboardPanel').hidden = true;
  var panel = document.getElementById('loginPanel');
  panel.hidden = false;
  panel.innerHTML =
    '<h3>Accès non autorisé</h3>' +
    '<p class="account-sub">Le compte ' + escapeHtml(currentSession.user.email) + ' n\'est pas rattaché à un profil coiffeur.</p>' +
    '<div class="form-actions"><a href="salon-odette-demo.html" class="btn btn-ghost">Retour au site</a></div>';
}

function showNotOwnerMessage(nom) {
  document.getElementById('dashboardPanel').hidden = true;
  var panel = document.getElementById('loginPanel');
  panel.hidden = false;
  panel.innerHTML =
    '<h3>Réservé au propriétaire</h3>' +
    '<p class="account-sub">Le compte ' + escapeHtml(currentSession.user.email) + ' (' + escapeHtml(nom) + ') n\'a pas les droits propriétaire — direction votre espace coiffeur habituel.</p>' +
    '<div class="form-actions"><a href="salon-odette-espace-coiffeur.html" class="btn btn-primary">Aller à l\'espace coiffeur</a></div>';
}

function checkOwnerAndLoad() {
  var myGeneration = sessionGeneration;
  sb.from('staff').select('*').eq('id', currentSession.user.id).maybeSingle().then(function (res) {
    if (myGeneration !== sessionGeneration) return;
    if (res.error || !res.data) {
      showNotStaffMessage();
      return;
    }
    if (!res.data.is_owner) {
      showNotOwnerMessage(res.data.nom);
      return;
    }
    currentStaff = res.data;
    loadOwnerData();
  });
}

function loadOwnerData() {
  var myGeneration = sessionGeneration;
  Promise.all([
    sb.from('bookings').select('*').order('appointment_at', { ascending: true }),
    sb.from('cancellations').select('*'),
    sb.from('profiles').select('*').order('prenom', { ascending: true }),
    sb.from('absences').select('*').order('date', { ascending: true })
  ]).then(function (results) {
    if (myGeneration !== sessionGeneration) return;
    var bookingsRes = results[0];
    var cancellationsRes = results[1];
    var profilesRes = results[2];
    var absencesRes = results[3];
    if (bookingsRes.error) console.error(bookingsRes.error);
    allBookingsForOwner = bookingsRes.data || [];
    if (cancellationsRes.error) console.error(cancellationsRes.error);
    allCancellationsForOwner = cancellationsRes.data || [];
    if (profilesRes.error) console.error(profilesRes.error);
    allClients = profilesRes.data || [];
    if (absencesRes.error) console.error(absencesRes.error);
    allAbsencesForOwner = absencesRes.data || [];

    // bookings.user_id référence auth.users, pas profiles directement — PostgREST ne peut
    // pas relier les deux tables automatiquement, d'où cette combinaison faite à la main.
    var profilesById = {};
    allClients.forEach(function (p) { profilesById[p.id] = p; });
    allBookingsForOwnerEnriched = allBookingsForOwner.map(function (b) {
      var p = profilesById[b.user_id];
      return {
        id: b.id,
        label: b.label,
        prestation: b.prestation,
        appointment_at: b.appointment_at,
        status: b.status || 'pending',
        coiffeur: b.coiffeur,
        clientPrenom: p ? p.prenom : 'client inconnu',
        clientTelephone: p ? p.telephone : '—'
      };
    });

    renderDashboard();
  });
}

// Calcule les indicateurs (RDV à venir, CA estimé, confirmés/annulés ce mois-ci,
// prestation la plus demandée) pour 'all' (salon entier) ou un nom de coiffeur précis. Un
// no_show est exclu du CA et des prestations les plus demandées (mais compte dans le total).
function computeOwnerStats(scope) {
  var now = Date.now();
  var bookings = scope === 'all' ? allBookingsForOwner : allBookingsForOwner.filter(function (b) { return b.coiffeur === scope; });
  var cancellations = scope === 'all' ? allCancellationsForOwner : allCancellationsForOwner.filter(function (c) { return c.coiffeur === scope; });
  var counted = bookings.filter(function (b) { return b.status !== 'no_show'; });
  var upcoming = bookings.filter(function (b) { return !b.appointment_at || new Date(b.appointment_at).getTime() >= now; });
  var revenue = counted.reduce(function (sum, b) {
    var price = PRESTATION_PRICES[b.prestation];
    return sum + (typeof price === 'number' ? price : 0);
  }, 0);
  var prestationCounts = {};
  counted.forEach(function (b) { prestationCounts[b.prestation] = (prestationCounts[b.prestation] || 0) + 1; });
  var topPrestation = Object.keys(prestationCounts).sort(function (a, b) { return prestationCounts[b] - prestationCounts[a]; })[0];
  return {
    upcoming: upcoming.length,
    revenue: revenue,
    confirmedThisMonth: bookings.filter(function (b) { return b.status === 'attended' && isThisMonth(b.appointment_at); }).length,
    cancelledThisMonth: cancellations.filter(function (c) { return isThisMonth(c.appointment_at); }).length,
    topPrestation: topPrestation,
    topPrestationCount: topPrestation ? prestationCounts[topPrestation] : 0
  };
}

// Dessine tout : en-tête + barre d'onglets + contenu de l'onglet actif. Rappelée à chaque
// interaction (voir wireOwnerSection) — pas de mise à jour partielle du DOM.
function renderDashboard() {
  document.getElementById('loginPanel').hidden = true;
  var panel = document.getElementById('dashboardPanel');
  panel.hidden = false;

  var tabLabels = { stats: 'Statistiques', clients: 'Clients', planning: 'Plannings & organisation' };
  var tabsHtml = '<div class="chip-row" style="margin-top:20px;">' +
    Object.keys(tabLabels).map(function (tab) {
      return '<button type="button" class="chip-btn' + (ownerActiveTab === tab ? ' active' : '') + '" data-owner-tab="' + tab + '">' + tabLabels[tab] + '</button>';
    }).join('') +
  '</div>';

  var bodyHtml = ownerActiveTab === 'clients' ? renderOwnerClientsTab()
    : ownerActiveTab === 'planning' ? renderOwnerPlanningTab()
    : renderOwnerStatsTab();

  panel.innerHTML =
    '<div class="staff-header"><h2>Bonjour, ' + escapeHtml(currentStaff.nom) + '</h2><button type="button" id="staffLogoutBtn" class="btn btn-ghost">Se déconnecter</button></div>' +
    '<p class="account-sub">Connecté en tant que ' + escapeHtml(currentSession.user.email) + ' — <a href="salon-odette-espace-coiffeur.html">← Votre planning personnel</a></p>' +
    tabsHtml +
    '<div style="margin-top:24px;">' + bodyHtml + '</div>';

  document.getElementById('staffLogoutBtn').addEventListener('click', function () {
    sessionGeneration++;
    sb.auth.signOut().then(function () {
      currentSession = null;
      currentStaff = null;
      allBookingsForOwner = [];
      allBookingsForOwnerEnriched = [];
      allAbsencesForOwner = [];
      allCancellationsForOwner = [];
      allClients = [];
      ownerActiveTab = 'stats';
      ownerStatsScope = 'all';
      ownerPlanningCoiffeur = null;
      ownerPlanningWeekOffset = 0;
      renderLoginForm();
    });
  });

  wireOwnerSection(panel);
}

// Onglet "Statistiques" : un sélecteur "Salon entier / Odette / Karim / Lina"
// (ownerStatsScope) au-dessus des mêmes 4 cartes que le tableau de bord personnel
// coiffeur, recalculées pour le scope choisi.
function renderOwnerStatsTab() {
  var scopeHtml = '<div class="chip-row">' +
    '<button type="button" class="chip-btn' + (ownerStatsScope === 'all' ? ' active' : '') + '" data-owner-scope="all">Salon entier</button>' +
    COIFFEURS.map(function (nom) {
      return '<button type="button" class="chip-btn' + (ownerStatsScope === nom ? ' active' : '') + '" data-owner-scope="' + escapeHtml(nom) + '">' + escapeHtml(nom) + '</button>';
    }).join('') +
  '</div>';

  var s = computeOwnerStats(ownerStatsScope);
  var title = ownerStatsScope === 'all' ? 'Salon entier' : ownerStatsScope;

  return scopeHtml +
    '<h3 style="margin-top:24px; font-size:1.2rem;">' + escapeHtml(title) + '</h3>' +
    '<div class="stat-cards" style="margin-top:16px;">' +
      '<div class="stat-card"><div class="stat-num mono">' + s.upcoming + '</div><div class="stat-label">RDV à venir</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + s.revenue + '&nbsp;€</div><div class="stat-label">CA estimé</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + s.confirmedThisMonth + '</div><div class="stat-label">confirmés ce mois-ci</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + s.cancelledThisMonth + '</div><div class="stat-label">annulés ce mois-ci</div></div>' +
    '</div>' +
    (s.topPrestation
      ? '<p class="account-sub" style="margin-top:16px;">Prestation la plus demandée : <strong>' + escapeHtml(s.topPrestation) + '</strong> (' + s.topPrestationCount + ' rendez-vous)</p>'
      : '<p class="account-empty" style="margin-top:16px;">Pas encore assez de données.</p>');
}

// Onglet "Clients" : liste de TOUS les clients du salon, avec nb de RDV et dernier
// rendez-vous calculés à partir de allBookingsForOwner (regroupés par user_id).
function renderOwnerClientsTab() {
  var bookingsByClient = {};
  allBookingsForOwner.forEach(function (b) {
    if (!bookingsByClient[b.user_id]) bookingsByClient[b.user_id] = [];
    bookingsByClient[b.user_id].push(b);
  });
  var clientRowsHtml = allClients.length
    ? allClients.map(function (c) {
        var theirBookings = bookingsByClient[c.id] || [];
        var last = theirBookings.slice().sort(function (a, b) { return new Date(b.appointment_at || 0).getTime() - new Date(a.appointment_at || 0).getTime(); })[0];
        return '<tr>' +
          '<td>' + escapeHtml(c.prenom) + '</td>' +
          '<td>' + escapeHtml(c.telephone) + '</td>' +
          '<td>' + escapeHtml(c.email || '—') + '</td>' +
          '<td class="mono">' + theirBookings.length + '</td>' +
          '<td>' + (last ? escapeHtml(last.label) : '—') + '</td>' +
        '</tr>';
      }).join('')
    : '<tr><td colspan="5" class="account-empty">Aucun client pour l\'instant.</td></tr>';

  return '<h3 style="font-size:1.2rem;">Clients du salon (' + allClients.length + ')</h3>' +
    '<div class="field" style="max-width:280px; margin-top:16px;"><label for="clientSearchInput">Rechercher un client</label><input type="text" id="clientSearchInput" placeholder="Prénom, téléphone, email..."></div>' +
    '<div class="client-table-wrap"><table class="client-table" id="clientTable"><thead><tr><th>Prénom</th><th>Téléphone</th><th>Email</th><th>RDV</th><th>Dernier RDV</th></tr></thead><tbody>' + clientRowsHtml + '</tbody></table></div>';
}

// Onglet "Plannings & organisation" : planning hebdomadaire de N'IMPORTE QUEL coiffeur
// choisi (ownerPlanningCoiffeur), avec un bouton pour attribuer/retirer la semaine
// AFFICHÉE à cet employé — plus les absences à venir de toute l'équipe en dessous.
function renderOwnerPlanningTab() {
  if (!ownerPlanningCoiffeur) ownerPlanningCoiffeur = currentStaff.nom; // par défaut, elle-même

  var pickerHtml = '<div class="chip-row">' +
    COIFFEURS.map(function (nom) {
      return '<button type="button" class="chip-btn' + (ownerPlanningCoiffeur === nom ? ' active' : '') + '" data-owner-planning-coiffeur="' + escapeHtml(nom) + '">' + escapeHtml(nom) + '</button>';
    }).join('') +
  '</div>';

  var monday = getMonday(new Date());
  var weekStart = new Date(monday.getTime());
  weekStart.setDate(weekStart.getDate() + ownerPlanningWeekOffset * 7);
  var weekEnd = new Date(weekStart.getTime());
  weekEnd.setDate(weekEnd.getDate() + 6);
  var weekLabel = weekStart.getDate() + ' ' + MOIS[weekStart.getMonth()] + ' – ' + weekEnd.getDate() + ' ' + MOIS[weekEnd.getMonth()];

  // La semaine affichée est-elle DÉJÀ entièrement bloquée pour ce coiffeur (une absence
  // "journée" sur chacun de ses jours ouverts) ? Détermine le sens du bouton ci-dessous.
  var workingDateKeys = getWorkingDaysInWeek(ownerPlanningWeekOffset).map(toDateKey);
  var journeeAbsentDateKeys = allAbsencesForOwner
    .filter(function (a) { return a.coiffeur === ownerPlanningCoiffeur && a.heure === 'journee'; })
    .map(function (a) { return a.date; });
  var isWholeWeekAssignedOff = workingDateKeys.length > 0 && workingDateKeys.every(function (k) { return journeeAbsentDateKeys.indexOf(k) !== -1; });

  var weekActionHtml = '<div class="form-actions" style="margin-top:20px; align-items:flex-end;">' +
    (isWholeWeekAssignedOff
      ? ''
      : '<div class="field" style="margin-bottom:0; flex:1; min-width:160px;"><label for="ownerWeekMotif">Motif (optionnel)</label><input type="text" id="ownerWeekMotif" placeholder="Congés, formation..."></div>') +
    '<button type="button" id="ownerWeekToggleBtn" class="btn ' + (isWholeWeekAssignedOff ? 'btn-ghost' : 'btn-primary') + '" data-owner-week-toggle="' + (isWholeWeekAssignedOff ? 'remove' : 'assign') + '">' +
      (isWholeWeekAssignedOff ? 'Réactiver la semaine pour ' + escapeHtml(ownerPlanningCoiffeur) : 'Marquer cette semaine comme non travaillée pour ' + escapeHtml(ownerPlanningCoiffeur)) +
    '</button>' +
  '</div>' +
  '<p id="ownerWeekStatus" class="login-alert" hidden></p>';

  return pickerHtml +
    '<div class="calendar-nav" style="margin-top:20px;">' +
      '<button type="button" class="btn btn-ghost" data-owner-planning-nav="-1">← Semaine précédente</button>' +
      '<span class="mono">' + weekLabel + '</span>' +
      '<button type="button" class="btn btn-ghost" data-owner-planning-nav="1">Semaine suivante →</button>' +
    '</div>' +
    '<div class="calendar-wrap"><div class="calendar">' + buildOwnerCalendarHtml(ownerPlanningCoiffeur, ownerPlanningWeekOffset) + '</div></div>' +
    weekActionHtml +
    '<h3 style="margin-top:32px; font-size:1.1rem;">Absences de toute l\'équipe</h3>' +
    renderOwnerTeamAbsencesHtml();
}

// Construit le HTML (une chaîne, pas des nœuds DOM) du planning hebdomadaire d'un
// coiffeur donné, à partir de allBookingsForOwnerEnriched et allAbsencesForOwner.
function buildOwnerCalendarHtml(coiffeurName, weekOffset) {
  var bookingsByLabel = {};
  allBookingsForOwnerEnriched.filter(function (b) { return b.coiffeur === coiffeurName; }).forEach(function (b) { bookingsByLabel[b.label] = b; });

  var absenceDates = {};
  var absentSlotsByLabel = {};
  allAbsencesForOwner.filter(function (a) { return a.coiffeur === coiffeurName; }).forEach(function (a) {
    if (a.heure === 'journee') {
      absenceDates[a.date] = true;
    } else {
      var parts = a.date.split('-');
      var absDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      var absDow = absDate.getDay();
      var absLabel = JOURS[absDow].charAt(0).toUpperCase() + JOURS[absDow].slice(1) + ' ' + absDate.getDate() + ' ' + MOIS[absDate.getMonth()] + ' à ' + a.heure;
      absentSlotsByLabel[absLabel] = true;
    }
  });

  var monday = getMonday(new Date());
  var weekStart = new Date(monday.getTime());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  var daysHtml = '';
  for (var dayIndex = 0; dayIndex < 7; dayIndex++) {
    var d = new Date(weekStart.getTime());
    d.setDate(weekStart.getDate() + dayIndex);
    var dow = d.getDay();
    var isClosedDay = dow === 0 || dow === 1;
    var isAbsentDay = !!absenceDates[toDateKey(d)];

    daysHtml += '<div class="cal-day' + ((isClosedDay || isAbsentDay) ? ' closed' : '') + '">' +
      '<div class="cal-day-head">' + JOURS[dow] + '<strong>' + d.getDate() + ' ' + MOIS[d.getMonth()] + '</strong></div>';

    if (isClosedDay || isAbsentDay) {
      daysHtml += '<div class="cal-day-closed-label">' + (isClosedDay ? 'Fermé' : 'Absent(e)') + '</div></div>';
      continue;
    }

    daysHtml += '<div class="cal-slots">';
    HEURES.forEach(function (heure) {
      var label = JOURS[dow].charAt(0).toUpperCase() + JOURS[dow].slice(1) + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' à ' + heure;
      var booking = bookingsByLabel[label];
      if (booking) {
        var statusIcon = booking.status === 'attended' ? ' ✓' : (booking.status === 'no_show' ? ' ✗' : '');
        daysHtml += '<div class="cal-slot busy' + (booking.status === 'no_show' ? ' no-show' : '') + '" title="' + escapeHtml(booking.prestation + ' — ' + booking.clientPrenom + ' (' + booking.clientTelephone + ')') + '">' + escapeHtml(heure) + statusIcon + '<br>' + escapeHtml(booking.clientPrenom) + '</div>';
      } else if (absentSlotsByLabel[label]) {
        daysHtml += '<div class="cal-slot absent-slot">' + escapeHtml(heure) + '<br>Absent(e)</div>';
      } else {
        daysHtml += '<div class="cal-slot">' + escapeHtml(heure) + '</div>';
      }
    });
    daysHtml += '</div></div>';
  }

  return daysHtml;
}

// Absences à venir de toute l'équipe, motif inclus (contrairement à ce qu'un coiffeur voit
// des autres normalement — voir la règle RLS dédiée dans salon-odette-schema.sql).
function renderOwnerTeamAbsencesHtml() {
  var todayKey = toDateKey(new Date());
  var upcoming = allAbsencesForOwner
    .filter(function (a) { return a.date >= todayKey; })
    .sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  if (!upcoming.length) return '<p class="account-empty" style="margin-top:16px;">Aucune absence prévue dans l\'équipe.</p>';
  return '<div class="booking-list" style="margin-top:16px;">' + upcoming.map(function (a) {
    var quand = a.heure === 'journee' ? 'Toute la journée' : escapeHtml(a.heure);
    return '<div class="booking-list-item">' + escapeHtml(a.coiffeur) + ' — ' + escapeHtml(formatDateFr(a.date)) +
      '<span class="presta">' + quand + (a.motif ? ' · ' + escapeHtml(a.motif) : '') + '</span></div>';
  }).join('') + '</div>';
}

// Câble tous les clics de la page (onglets, sélecteurs, navigation semaine, bouton
// attribuer/retirer une semaine, recherche client) — chacun met à jour une variable
// d'état puis rappelle renderDashboard(), ou loadOwnerData() après une écriture en base.
function wireOwnerSection(container) {
  container.querySelectorAll('[data-owner-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ownerActiveTab = btn.getAttribute('data-owner-tab');
      renderDashboard();
    });
  });

  container.querySelectorAll('[data-owner-scope]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ownerStatsScope = btn.getAttribute('data-owner-scope');
      renderDashboard();
    });
  });

  container.querySelectorAll('[data-owner-planning-coiffeur]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ownerPlanningCoiffeur = btn.getAttribute('data-owner-planning-coiffeur');
      ownerPlanningWeekOffset = 0;
      renderDashboard();
    });
  });

  container.querySelectorAll('[data-owner-planning-nav]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ownerPlanningWeekOffset += parseInt(btn.getAttribute('data-owner-planning-nav'), 10);
      renderDashboard();
    });
  });

  // Attribue ("assign") ou retire ("remove") la semaine affichée à ownerPlanningCoiffeur —
  // une ligne `absences` (heure='journee') par jour ouvert de la semaine. upsert plutôt
  // qu'insert : si un ou plusieurs jours sont déjà bloqués individuellement, on complète/
  // met juste à jour leur motif au lieu d'échouer sur la contrainte unique coiffeur+date+heure.
  var weekToggleBtn = container.querySelector('[data-owner-week-toggle]');
  if (weekToggleBtn) {
    weekToggleBtn.addEventListener('click', function () {
      var action = weekToggleBtn.getAttribute('data-owner-week-toggle');
      var statusEl = container.querySelector('#ownerWeekStatus');
      var workingDateKeys = getWorkingDaysInWeek(ownerPlanningWeekOffset).map(toDateKey);

      var request;
      if (action === 'remove') {
        request = sb.from('absences').delete()
          .eq('coiffeur', ownerPlanningCoiffeur).eq('heure', 'journee').in('date', workingDateKeys);
      } else {
        var motifInput = container.querySelector('#ownerWeekMotif');
        var motif = motifInput ? motifInput.value.trim() : '';
        var rows = workingDateKeys.map(function (dateKey) {
          return { coiffeur: ownerPlanningCoiffeur, date: dateKey, heure: 'journee', motif: motif || null };
        });
        request = sb.from('absences').upsert(rows, { onConflict: 'coiffeur,date,heure' });
      }

      request.then(function (res) {
        if (res.error) {
          if (statusEl) { statusEl.textContent = 'Erreur : ' + res.error.message; statusEl.hidden = false; }
          return;
        }
        loadOwnerData();
      });
    });
  }

  // Recherche client : filtre simple, côté client, sur le texte de chaque ligne.
  var searchInput = container.querySelector('#clientSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      var q = searchInput.value.trim().toLowerCase();
      container.querySelectorAll('#clientTable tbody tr').forEach(function (row) {
        row.hidden = q.length > 0 && row.textContent.toLowerCase().indexOf(q) === -1;
      });
    });
  }
}

sb.auth.getSession().then(function (res) {
  if (res.data.session) {
    currentSession = res.data.session;
    checkOwnerAndLoad();
  } else {
    renderLoginForm();
  }
});
