/*
  ============================================================================
  SALON ODETTE — ESPACE COIFFEUR (emploi du temps + statistiques personnelles)
  ============================================================================

  OBJECTIFS DE CE FICHIER
  - Faire tourner la page salon-odette-espace-coiffeur.html : une page séparée
    du site public, réservée à l'équipe (Odette, Karim, Lina).
  - Vérifier que le compte connecté correspond bien à un coiffeur (table
    `staff` — voir salon-odette-schema.sql), sinon refuser l'accès.
  - Afficher SON PROPRE planning, sous forme de calendrier hebdomadaire
    (même principe visuel que le calendrier client dans
    salon-odette-reservation.js, mais qui montre directement qui est
    réservé — pas de "libre/complet" caché : c'est le planning du coiffeur
    lui-même) et quelques statistiques : nombre de RDV à venir / sous 7
    jours / au total, chiffre d'affaires estimé, et la prestation la plus
    demandée avec un petit graphique en barres.

  CONTRAIREMENT AUX AUTRES FICHIERS DU SITE : cette page ne partage PAS son
  espace global avec salon-odette-connexion.js / client.js / reservation.js —
  elle a son propre client Supabase et sa propre logique, complètement
  indépendante, puisqu'elle vit sur une page HTML séparée. Elle redéfinit
  donc ses propres JOURS/MOIS/HEURES/getMonday (mêmes valeurs que
  reservation.js, dupliquées volontairement plutôt que partagées).

  CE QUI A ÉTÉ FAIT (2026-09-03)
  - Connexion email + mot de passe (mêmes comptes Supabase que le site
    client, mais un compte doit avoir une ligne dans `staff` pour voir le
    tableau de bord — sinon message "Accès non autorisé").
  - Planning en calendrier hebdomadaire (navigation semaine par semaine,
    comme le calendrier de réservation client) : chaque créneau réservé
    affiche directement le prénom du client dessus (info complète au survol
    via le titre), les créneaux libres restent neutres. Autorisé par une
    règle RLS dédiée : un coiffeur ne voit un profil client QUE si ce client
    a un rendez-vous avec lui. Contrairement au calendrier client, on peut
    aussi naviguer vers les semaines passées (pas de limite basse).
  - Statistiques : compteurs (à venir / sous 7 jours / total), chiffre
    d'affaires estimé (tarifs approximatifs codés en dur, à rapprocher des
    vrais tarifs du site le jour où ils seront gérés depuis une interface),
    et un graphique en barres (SVG fait main, pas de librairie externe) des
    prestations les plus demandées.
  - "Prochain rendez-vous" mis en avant en haut de page.
  - Jours/créneaux d'absence (congés, maladie, formation, pause imprévue...) :
    le coiffeur pose une date + soit "Toute la journée" soit une plage
    "De ... à ..." (menus absDebut/absFin, tous deux parmi HEURES) + un motif
    optionnel. Une plage n'est pas stockée comme un intervalle : elle crée
    UNE LIGNE PAR CRÉNEAU compris dedans dans `absences` (colonne `heure`,
    'journee' par défaut pour une journée entière) — un upsert (pas un
    simple insert) évite une erreur si la plage recoupe un créneau déjà
    marqué absent. Liste des absences à venir avec bouton "Retirer" — une
    plage de plusieurs créneaux apparaît pour l'instant comme plusieurs
    lignes séparées, pas encore regroupées visuellement (voir plus bas).
    Le jour ou le créneau marqué apparaît aussi "Absent(e)" sur SON PROPRE
    calendrier ci-dessus (renderScheduleCalendar distingue les deux via
    absenceDates vs absentSlotsByLabel). Le motif reste privé (RLS) — seule
    la vue publique `absence_days` (coiffeur + date + heure, jamais le
    motif) est lue par salon-odette-reservation.js pour fermer la journée
    entière OU juste ces créneaux sur le calendrier client. Une absence
    n'annule PAS automatiquement les RDV déjà pris (pas encore géré, voir
    plus bas).

  - Suivi de présence (2026-09-03) : une fois l'heure du rendez-vous passée,
    il apparaît dans "Rendez-vous à valider" tant que le coiffeur n'a pas
    cliqué "✓ Venu(e)" ou "✗ Absent(e)" (colonne `bookings.status`, RLS
    élargie pour qu'un coiffeur modifie ses propres rendez-vous assignés, pas
    seulement le client). Un rendez-vous marqué "Absent(e)" (no-show) est
    EXCLU du chiffre d'affaires estimé et des prestations les plus demandées
    (il compte quand même dans le total "historique inclus") — un client qui
    n'est pas venu n'a généré ni service réel ni argent. Statut aussi visible
    directement sur le calendrier (✓/✗ + créneau barré si absent).
  - Deux statistiques mensuelles (2026-09-03) : "confirmés ce mois-ci" (RDV
    validés "Venu(e)" dont la date d'origine tombe dans le mois calendaire en
    cours) et "annulés ce mois-ci" — nécessite une nouvelle table
    `cancellations` : jusqu'ici, annuler un RDV (côté client) supprimait la
    ligne sans laisser de trace, impossible à compter après coup.
    salon-odette-client.js enregistre maintenant une ligne dans
    `cancellations` (coiffeur/prestation/date d'origine, jamais l'identité du
    client) juste après la suppression, en best-effort (n'empêche pas
    l'annulation de réussir si cet enregistrement échoue). Les deux
    statistiques comptent par la date PRÉVUE du rendez-vous, pas par la date
    de l'action (validation/annulation) — pour raconter "sur les RDV prévus
    ce mois-ci, combien ont eu lieu, combien ont été annulés".
  - Annuler un rendez-vous soi-même (2026-09-03) : liste "Vos prochains
    rendez-vous" avec un bouton "Annuler ce rendez-vous" par ligne — RLS
    élargie (bookings_delete_own) pour qu'un coiffeur supprime aussi ses
    propres rendez-vous assignés, pas seulement le client. Enregistre une
    trace dans `cancellations` comme une annulation côté client (même
    logique, mêmes statistiques). Le client n'est PAS prévenu
    automatiquement (pas de système d'email/SMS) — message d'avertissement
    affiché à l'écran pour que le coiffeur pense à le contacter lui-même.

  - Espace propriétaire, sur une AUTRE page (2026-09-04) : un coiffeur dont
    la ligne `staff` a `is_owner = true` (aujourd'hui : Odette, réglé à la
    main dans Supabase, voir salon-odette-schema.sql) voit un lien "→ Espace
    propriétaire" apparaître ici (voir plus bas dans renderDashboard()), vers
    salon-odette-espace-proprietaire.html + salon-odette-proprietaire.js —
    une page à part, avec son propre login, qui regroupe tout ce qui dépasse
    SON PROPRE planning (statistiques du salon entier, liste de tous les
    clients, planning de n'importe quel coiffeur...). Ce fichier-ci reste
    volontairement identique pour un coiffeur normal ET pour la propriétaire
    — elle voit ici exactement ce que voit Karim/Lina, rien de plus, pour ne
    pas noyer son tableau de bord perso sous les infos de gestion du salon.
    (Une première version avait tout mis sur cette seule page, sous forme
    d'onglets ajoutés en dessous du tableau personnel — séparé en deux pages
    le 2026-09-04 car trop chargé pour un usage quotidien.)

  CE QU'IL RESTE À FAIRE / IDÉES POUR LA SUITE
  - Regrouper visuellement une plage d'absence (ex. "14h00 → 17h00" sur une
    seule ligne avec un seul bouton "Retirer") au lieu d'une ligne par
    créneau comme aujourd'hui — nécessite de grouper myAbsences par
    date+motif et détecter les créneaux consécutifs dans renderAbsenceListHtml().
  - Voir salon-odette-proprietaire.js pour ce qu'il reste à faire côté espace
    propriétaire (gérer l'équipe/tarifs depuis une interface, exporter les
    clients...).

  FONCTIONS DE CE FICHIER
  - toDateKey(d) / formatDateFr(dateStr) : conversions entre un objet Date JS
    et le format texte "AAAA-MM-JJ" utilisé par la colonne `date` (Postgres)
    et par l'input HTML de type date.
  - isThisMonth(dateVal) : vrai si une date (texte ISO ou objet Date) tombe
    dans le mois calendaire en cours — utilisé pour les deux statistiques
    mensuelles (confirmés/annulés ce mois-ci).
  - escapeHtml(str) : échappe un texte avant de l'insérer dans le HTML
    généré (prénom/téléphone client), même logique que escapeAttr ailleurs.
  - renderLoginForm(errorMsg) : dessine le formulaire de connexion (ou un
    message d'erreur au-dessus, ex. mot de passe incorrect).
  - showNotStaffMessage() : affiche "Accès non autorisé" quand le compte
    connecté n'a pas de ligne dans `staff`.
  - checkStaffAndLoad() : vérifie dans `staff` si le compte connecté est un
    coiffeur ; si oui, lance loadDashboardData(), sinon showNotStaffMessage().
  - loadDashboardData() : va chercher en parallèle les rendez-vous assignés à
    ce coiffeur (puis les profils des clients concernés — bookings.user_id
    référence auth.users, pas profiles directement, donc PostgREST ne peut
    pas les relier automatiquement, d'où deux requêtes séparées combinées à
    la main) et ses absences, puis appelle renderDashboard().
  - renderDashboard() : construit tout le tableau de bord (prochain RDV,
    rendez-vous à valider, vos prochains rendez-vous, compteurs, calendrier,
    absences, statistiques) à partir de myBookings et myAbsences. Les
    rendez-vous "no_show" sont exclus du calcul des statistiques (chiffre
    d'affaires, prestations les plus demandées) mais pas du décompte total.
    Câble aussi les boutons "✓ Venu(e)" / "✗ Absent(e)" (update({status:...})
    direct sur la ligne bookings) et "Annuler ce rendez-vous" (delete + trace
    dans cancellations, même logique que salon-odette-client.js).
  - renderAbsenceListHtml() : construit la liste des absences à venir
    ("Toute la journée" ou l'heure précise + motif) avec leur bouton "Retirer".
  - getMonday(date) : renvoie le lundi de la semaine d'une date donnée
    (identique à celle de salon-odette-reservation.js).
  - renderScheduleCalendar() : dessine le calendrier hebdomadaire du
    planning (semaine courante + staffWeekOffset), en associant chaque
    créneau à un rendez-vous de myBookings par son libellé, chaque jour à
    une éventuelle absence "journée" de myAbsences, et chaque créneau libre
    à une éventuelle absence "créneau précis" (même reconstruction de
    libellé que côté client, voir labelFromDateAndHeure dans
    salon-odette-reservation.js).
  - renderBarChart(counts) : dessine le graphique en barres (SVG) du nombre
    de rendez-vous par prestation.

  DÉPEND DE : rien d'autre que la librairie Supabase (chargée par CDN dans
  salon-odette-espace-coiffeur.html) — voir la remarque ci-dessus, ce fichier
  est volontairement indépendant du reste du site (et de
  salon-odette-proprietaire.js, qui a lui aussi son propre client Supabase).
  ============================================================================
*/

var SUPABASE_URL = 'https://vyqbbqeskzyromoyxrff.supabase.co';
var SUPABASE_KEY = 'sb_publishable_zR0jfkgIXbfDrLPLxurx7w_QJIDW1t6';
// persistSession: true (2026-09-04, revenu sur le false d'origine — voir la remarque dans
// salon-odette-connexion.js) : nécessaire pour qu'une connexion faite ici soit reconnue
// automatiquement sur salon-odette-espace-proprietaire.html sans se reconnecter — les deux
// pages utilisent le même projet Supabase, la session est donc partagée via le
// localStorage du navigateur. Revers de la médaille en testant plusieurs comptes coiffeur
// d'affilée : recharger la page ne redemande plus de mot de passe automatiquement, il faut
// cliquer "Se déconnecter" avant de se connecter avec un autre compte.
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true } });

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

// Mêmes constantes que salon-odette-reservation.js (fichier volontairement indépendant,
// voir en-tête) — nécessaires pour reconstruire les mêmes libellés de créneau ("Mer 3
// sept à 10h00") et les faire correspondre aux rendez-vous du coiffeur.
var JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
var HEURES = ['9h00', '10h00', '11h00', '14h00', '15h00', '16h00', '17h00'];
var MAX_WEEKS_AHEAD = 7;
var staffWeekOffset = 0;

var currentSession = null;
var currentStaff = null; // { id, nom, is_owner }
var myBookings = []; // rendez-vous du coiffeur connecté, avec clientPrenom/clientTelephone ajoutés
var myAbsences = []; // { id, coiffeur, date, motif } — jours d'absence du coiffeur connecté
var myCancellations = []; // { id, coiffeur, prestation, appointment_at, cancelled_at } — historique des annulations

// Vrai pour une date (chaîne ISO ou objet Date) tombant dans le mois calendaire en cours.
function isThisMonth(dateVal) {
  if (!dateVal) return false;
  var d = new Date(dateVal);
  var now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function toDateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDateFr(dateStr) {
  var parts = dateStr.split('-');
  var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
}

// Incrémenté à chaque connexion/déconnexion. Sert à ignorer une réponse réseau qui
// arriverait après coup pour une session qui n'est déjà plus la session active — sinon,
// se déconnecter puis se reconnecter très vite avec un autre compte pouvait afficher le
// mauvais coiffeur si la première requête (pour l'ancien compte) répondait après la
// seconde (pour le nouveau compte).
var sessionGeneration = 0;

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderLoginForm(errorMsg) {
  document.getElementById('dashboardPanel').hidden = true;
  var panel = document.getElementById('loginPanel');
  panel.hidden = false;
  panel.innerHTML =
    '<h3>Connexion coiffeur</h3>' +
    '<p class="account-sub">Réservé à l\'équipe du salon.</p>' +
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
    // Se déconnecter d'abord, même si on ne PENSE pas être déjà connecté : évite qu'une
    // session précédente (ex. un autre coiffeur testé juste avant, sans avoir cliqué
    // "Se déconnecter") ne reste active en arrière-plan et fausse la connexion suivante.
    sessionGeneration++;
    sb.auth.signOut().then(function () {
      var myGeneration = sessionGeneration;
      sb.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
        if (myGeneration !== sessionGeneration) return; // une autre connexion a eu lieu entre-temps
        if (res.error) {
          status.textContent = 'Email ou mot de passe incorrect.';
          status.hidden = false;
          return;
        }
        currentSession = res.data.session;
        checkStaffAndLoad();
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

function checkStaffAndLoad() {
  var myGeneration = sessionGeneration;
  sb.from('staff').select('*').eq('id', currentSession.user.id).maybeSingle().then(function (res) {
    if (myGeneration !== sessionGeneration) return; // réponse périmée, une session plus récente a pris le relais
    if (res.error || !res.data) {
      showNotStaffMessage();
      return;
    }
    currentStaff = res.data;
    loadDashboardData();
  });
}

function loadDashboardData() {
  var myGeneration = sessionGeneration;
  // Rendez-vous, absences et annulations récupérés en parallèle (indépendants les uns des
  // autres).
  Promise.all([
    sb.from('bookings').select('*').eq('coiffeur', currentStaff.nom).order('appointment_at', { ascending: true }),
    sb.from('absences').select('*').eq('coiffeur', currentStaff.nom).order('date', { ascending: true }),
    sb.from('cancellations').select('*').eq('coiffeur', currentStaff.nom)
  ]).then(function (results) {
    if (myGeneration !== sessionGeneration) return;
    var bookingsRes = results[0];
    var absencesRes = results[1];
    var cancellationsRes = results[2];
    if (absencesRes.error) console.error(absencesRes.error);
    myAbsences = absencesRes.data || [];
    if (cancellationsRes.error) console.error(cancellationsRes.error);
    myCancellations = cancellationsRes.data || [];

    if (bookingsRes.error) { console.error(bookingsRes.error); return; }
    var bookings = bookingsRes.data || [];
    var userIds = bookings.map(function (b) { return b.user_id; }).filter(function (id, i, arr) { return arr.indexOf(id) === i; });

    if (!userIds.length) {
      myBookings = [];
      renderDashboard();
      return;
    }

    // bookings.user_id référence auth.users, pas profiles directement — PostgREST ne
    // peut donc pas relier les deux tables automatiquement en une seule requête, d'où
    // ces deux requêtes séparées combinées ici à la main.
    sb.from('profiles').select('id, prenom, telephone').in('id', userIds).then(function (profilesRes) {
      if (myGeneration !== sessionGeneration) return;
      var profilesById = {};
      (profilesRes.data || []).forEach(function (p) { profilesById[p.id] = p; });
      myBookings = bookings.map(function (b) {
        var p = profilesById[b.user_id];
        return {
          id: b.id,
          label: b.label,
          prestation: b.prestation,
          appointment_at: b.appointment_at,
          status: b.status || 'pending',
          clientPrenom: p ? p.prenom : 'client inconnu',
          clientTelephone: p ? p.telephone : '—'
        };
      });
      renderDashboard();
    });
  });
}

function renderDashboard() {
  document.getElementById('loginPanel').hidden = true;
  var panel = document.getElementById('dashboardPanel');
  panel.hidden = false;

  var now = Date.now();
  var sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  var upcoming = myBookings.filter(function (b) { return !b.appointment_at || new Date(b.appointment_at).getTime() >= now; });
  var withinWeek = upcoming.filter(function (b) { return b.appointment_at && new Date(b.appointment_at).getTime() < now + sevenDaysMs; });
  var nextBooking = upcoming[0];

  // Rendez-vous déjà passés mais jamais validés (venu / absent) — à confirmer en priorité.
  var toValidate = myBookings.filter(function (b) {
    return b.appointment_at && new Date(b.appointment_at).getTime() < now && b.status === 'pending';
  });

  // Un no-show n'a généré ni prestation réelle ni chiffre d'affaires : on l'exclut des
  // statistiques ci-dessous (mais il compte toujours dans le total "historique inclus").
  var countedBookings = myBookings.filter(function (b) { return b.status !== 'no_show'; });

  var prestationCounts = {};
  countedBookings.forEach(function (b) { prestationCounts[b.prestation] = (prestationCounts[b.prestation] || 0) + 1; });
  var topPrestation = Object.keys(prestationCounts).sort(function (a, b) { return prestationCounts[b] - prestationCounts[a]; })[0];

  var estimatedRevenue = countedBookings.reduce(function (sum, b) {
    var price = PRESTATION_PRICES[b.prestation];
    return sum + (typeof price === 'number' ? price : 0);
  }, 0);

  // "Confirmé" = validé "Venu(e)" (voir la section "Rendez-vous à valider" plus bas),
  // pour un rendez-vous prévu ce mois-ci. Les annulations sont comptées par la date du
  // rendez-vous d'origine, pas par la date à laquelle le client a annulé — pour raconter
  // "sur les RDV prévus ce mois-ci, combien ont eu lieu / combien ont été annulés".
  var confirmedThisMonth = myBookings.filter(function (b) { return b.status === 'attended' && isThisMonth(b.appointment_at); }).length;
  var cancelledThisMonth = myCancellations.filter(function (c) { return isThisMonth(c.appointment_at); }).length;

  var toValidateHtml = toValidate.length
    ? '<div class="booking-list" style="margin-top:16px;">' + toValidate.map(function (b) {
        return '<div class="booking-list-item">' + escapeHtml(b.label) +
          '<span class="presta">' + escapeHtml(b.prestation) + ' · ' + escapeHtml(b.clientPrenom) + '</span>' +
          '<div class="form-actions" style="margin-top:8px;">' +
            '<button type="button" class="btn btn-primary" data-validate-id="' + b.id + '" data-validate-status="attended" style="padding:7px 16px; font-size:0.82rem;">✓ Venu(e)</button>' +
            '<button type="button" class="btn btn-ghost" data-validate-id="' + b.id + '" data-validate-status="no_show" style="padding:7px 16px; font-size:0.82rem;">✗ Absent(e)</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>'
    : '';

  var upcomingListHtml = upcoming.length
    ? '<div class="booking-list" style="margin-top:16px;">' + upcoming.map(function (b) {
        return '<div class="booking-list-item">' + escapeHtml(b.label) +
          '<span class="presta">' + escapeHtml(b.prestation) + ' · ' + escapeHtml(b.clientPrenom) + ' (' + escapeHtml(b.clientTelephone) + ')</span>' +
          '<button type="button" class="booking-action-btn" data-cancel-id="' + b.id + '" style="margin-top:8px;">Annuler ce rendez-vous</button>' +
        '</div>';
      }).join('') + '</div>'
    : '<p class="account-empty" style="margin-top:16px;">Aucun rendez-vous à venir.</p>';

  panel.innerHTML =
    '<div class="staff-header"><h2>Bonjour, ' + escapeHtml(currentStaff.nom) + '</h2><button type="button" id="staffLogoutBtn" class="btn btn-ghost">Se déconnecter</button></div>' +
    '<p class="account-sub">Connecté en tant que ' + escapeHtml(currentSession.user.email) +
      (currentStaff.is_owner ? ' — <a href="salon-odette-espace-proprietaire.html">Espace propriétaire →</a>' : '') +
    '</p>' +
    (nextBooking
      ? '<p class="next-appt">Prochain rendez-vous : <strong>' + escapeHtml(nextBooking.label) + '</strong> — ' + escapeHtml(nextBooking.prestation) + ' avec ' + escapeHtml(nextBooking.clientPrenom) + '</p>'
      : '<p class="next-appt">Aucun rendez-vous à venir pour l\'instant.</p>') +
    (toValidate.length ? '<h3 style="margin-top:32px; font-size:1.3rem;">Rendez-vous à valider (' + toValidate.length + ')</h3>' + toValidateHtml : '') +
    '<h3 style="margin-top:32px; font-size:1.3rem;">Vos prochains rendez-vous (' + upcoming.length + ')</h3>' +
    '<p class="account-sub">Le client n\'est pas prévenu automatiquement d\'une annulation — contactez-le si besoin.</p>' +
    upcomingListHtml +
    '<div class="stat-cards" style="margin-top:32px;">' +
      '<div class="stat-card"><div class="stat-num mono">' + upcoming.length + '</div><div class="stat-label">à venir</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + withinWeek.length + '</div><div class="stat-label">sous 7 jours</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + myBookings.length + '</div><div class="stat-label">total (historique inclus)</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + estimatedRevenue + '&nbsp;€</div><div class="stat-label">CA estimé</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + confirmedThisMonth + '</div><div class="stat-label">confirmés ce mois-ci</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + cancelledThisMonth + '</div><div class="stat-label">annulés ce mois-ci</div></div>' +
    '</div>' +
    '<h3 style="margin-top:40px; font-size:1.3rem;">Votre planning</h3>' +
    '<div class="calendar-nav">' +
      '<button type="button" id="staffPrevWeekBtn" class="btn btn-ghost">← Semaine précédente</button>' +
      '<span class="mono" id="staffWeekLabel"></span>' +
      '<button type="button" id="staffNextWeekBtn" class="btn btn-ghost">Semaine suivante →</button>' +
    '</div>' +
    '<div class="calendar-wrap"><div class="calendar" id="staffCalendar"></div></div>' +
    '<h3 style="margin-top:40px; font-size:1.3rem;">Vos absences</h3>' +
    '<p class="account-sub">Bloque toute la journée, un seul créneau, ou une plage (ex. de 14h00 à 17h00) chez vous sur le calendrier des clients (congés, maladie, formation, pause imprévue...). Un rendez-vous déjà pris n\'est PAS annulé automatiquement — contactez le client si besoin.</p>' +
    '<div class="form-actions" style="align-items:flex-end;">' +
      '<div class="field" style="margin-bottom:0;"><label for="absDate">Date</label><input type="date" id="absDate"></div>' +
      '<div class="field" style="margin-bottom:0;"><label for="absDebut">De</label><select id="absDebut">' +
        '<option value="journee">Toute la journée</option>' +
        HEURES.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field" style="margin-bottom:0;"><label for="absFin">à</label><select id="absFin">' +
        HEURES.map(function (h) { return '<option value="' + h + '">' + h + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field" style="margin-bottom:0; flex:1; min-width:160px;"><label for="absMotif">Motif (optionnel)</label><input type="text" id="absMotif" placeholder="Congés, formation..."></div>' +
      '<button type="button" id="absAddBtn" class="btn btn-primary">Ajouter</button>' +
    '</div>' +
    '<p id="absStatus" class="login-alert" hidden></p>' +
    renderAbsenceListHtml() +
    '<h3 style="margin-top:40px; font-size:1.3rem;">Prestations les plus demandées</h3>' +
    (topPrestation ? '<p class="account-sub" style="margin-top:8px;">La plus demandée : <strong>' + escapeHtml(topPrestation) + '</strong> (' + prestationCounts[topPrestation] + ' rendez-vous au total)</p>' : '<p class="account-empty">Pas encore assez de données.</p>') +
    '<div id="statsChart" style="margin-top:12px;"></div>';

  document.getElementById('staffLogoutBtn').addEventListener('click', function () {
    sessionGeneration++;
    sb.auth.signOut().then(function () {
      currentSession = null;
      currentStaff = null;
      myBookings = [];
      renderLoginForm();
    });
  });

  document.getElementById('staffPrevWeekBtn').addEventListener('click', function () {
    staffWeekOffset--;
    renderScheduleCalendar();
  });
  document.getElementById('staffNextWeekBtn').addEventListener('click', function () {
    if (staffWeekOffset < MAX_WEEKS_AHEAD) { staffWeekOffset++; renderScheduleCalendar(); }
  });

  var absDebutSelect = document.getElementById('absDebut');
  var absFinSelect = document.getElementById('absFin');
  function syncAbsFinDisabled() { absFinSelect.disabled = absDebutSelect.value === 'journee'; }
  syncAbsFinDisabled();
  absDebutSelect.addEventListener('change', syncAbsFinDisabled);

  document.getElementById('absAddBtn').addEventListener('click', function () {
    var dateVal = document.getElementById('absDate').value; // déjà au format "AAAA-MM-JJ"
    var debutVal = absDebutSelect.value; // "journee" ou un créneau de départ
    var finVal = absFinSelect.value; // ignoré si debutVal === "journee"
    var motif = document.getElementById('absMotif').value.trim();
    var status = document.getElementById('absStatus');
    if (!dateVal) {
      status.textContent = 'Choisissez une date.';
      status.hidden = false;
      return;
    }

    var rows;
    if (debutVal === 'journee') {
      rows = [{ coiffeur: currentStaff.nom, date: dateVal, heure: 'journee', motif: motif || null }];
    } else {
      // Une plage (ex. "de 14h00 à 17h00") crée une ligne par créneau de HEURES compris
      // dans l'intervalle — pas de vraie notion d'intervalle en base, juste plusieurs
      // absences "créneau précis" créées d'un coup, chacune traitée comme d'habitude.
      var debutIndex = HEURES.indexOf(debutVal);
      var finIndex = HEURES.indexOf(finVal);
      if (finIndex < debutIndex) {
        status.textContent = 'L\'heure de fin doit être après (ou égale à) l\'heure de début.';
        status.hidden = false;
        return;
      }
      rows = HEURES.slice(debutIndex, finIndex + 1).map(function (h) {
        return { coiffeur: currentStaff.nom, date: dateVal, heure: h, motif: motif || null };
      });
    }

    // upsert plutôt qu'insert : si la plage recoupe un créneau déjà marqué absent, on
    // met juste à jour son motif au lieu de faire échouer tout le lot (contrainte unique
    // coiffeur+date+heure).
    sb.from('absences').upsert(rows, { onConflict: 'coiffeur,date,heure' }).then(function (res) {
      if (res.error) {
        status.textContent = 'Erreur : ' + res.error.message;
        status.hidden = false;
        return;
      }
      loadDashboardData();
    });
  });

  panel.querySelectorAll('[data-abs-id]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      sb.from('absences').delete().eq('id', btn.getAttribute('data-abs-id')).then(function (res) {
        if (res.error) { window.alert('Erreur : ' + res.error.message); return; }
        loadDashboardData();
      });
    });
  });

  panel.querySelectorAll('[data-validate-id]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var bookingId = btn.getAttribute('data-validate-id');
      var newStatus = btn.getAttribute('data-validate-status');
      sb.from('bookings').update({ status: newStatus }).eq('id', bookingId).then(function (res) {
        if (res.error) { window.alert('Erreur : ' + res.error.message); return; }
        loadDashboardData();
      });
    });
  });

  panel.querySelectorAll('[data-cancel-id]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var bookingId = btn.getAttribute('data-cancel-id');
      if (!window.confirm('Annuler ce rendez-vous ? Le client ne sera pas averti automatiquement.')) return;
      var booking = myBookings.filter(function (b) { return b.id === bookingId; })[0];
      sb.from('bookings').delete().eq('id', bookingId).then(function (res) {
        if (res.error) { window.alert('Erreur : ' + res.error.message); return; }
        // Trace de l'annulation pour les statistiques (voir myCancellations plus haut) —
        // best-effort, comme côté client dans salon-odette-client.js.
        if (booking) {
          sb.from('cancellations').insert({
            coiffeur: currentStaff.nom,
            prestation: booking.prestation,
            appointment_at: booking.appointment_at,
            cancelled_by: currentSession.user.id
          }).then(function (cancelRes) {
            if (cancelRes.error) console.error(cancelRes.error);
          });
        }
        loadDashboardData();
      });
    });
  });

  renderScheduleCalendar();
  renderBarChart(prestationCounts);
}

function renderAbsenceListHtml() {
  var todayKey = toDateKey(new Date());
  var upcomingAbsences = myAbsences.filter(function (a) { return a.date >= todayKey; });
  if (!upcomingAbsences.length) return '<p class="account-empty" style="margin-top:16px;">Aucune absence prévue.</p>';
  return '<div class="booking-list" style="margin-top:16px;">' + upcomingAbsences.map(function (a) {
    var quand = a.heure === 'journee' ? 'Toute la journée' : escapeHtml(a.heure);
    return '<div class="booking-list-item">' + escapeHtml(formatDateFr(a.date)) +
      '<span class="presta">' + quand + (a.motif ? ' · ' + escapeHtml(a.motif) : '') + '</span>' +
      '<button type="button" class="booking-action-btn" data-abs-id="' + a.id + '" style="margin-top:6px;">Retirer</button>' +
      '</div>';
  }).join('') + '</div>';
}

function getMonday(date) {
  var d = new Date(date.getTime());
  var day = d.getDay();
  var diff = (day === 0 ? -6 : 1 - day); // recule jusqu'au lundi
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Contrairement au calendrier client (qui ne montre que "libre"/"complet" sans révéler
// qui a réservé), ici on a le droit de tout montrer : c'est le planning du coiffeur
// lui-même, pour SES PROPRES rendez-vous — d'où le prénom du client affiché directement
// sur le créneau concerné.
function renderScheduleCalendar() {
  var calendarEl = document.getElementById('staffCalendar');
  if (!calendarEl) return;
  calendarEl.innerHTML = '';

  var bookingsByLabel = {};
  myBookings.forEach(function (b) { bookingsByLabel[b.label] = b; });

  var absenceDates = {}; // journées entières
  var absentSlotsByLabel = {}; // créneaux précis (même format que bookingsByLabel)
  myAbsences.forEach(function (a) {
    if (a.heure === 'journee') {
      absenceDates[a.date] = a.motif || 'Absence';
    } else {
      var parts = a.date.split('-');
      var absDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      var absDow = absDate.getDay();
      var absLabel = JOURS[absDow].charAt(0).toUpperCase() + JOURS[absDow].slice(1) + ' ' + absDate.getDate() + ' ' + MOIS[absDate.getMonth()] + ' à ' + a.heure;
      absentSlotsByLabel[absLabel] = a.motif || 'Absence';
    }
  });

  var monday = getMonday(new Date());
  var weekStart = new Date(monday.getTime());
  weekStart.setDate(weekStart.getDate() + staffWeekOffset * 7);
  var weekEnd = new Date(weekStart.getTime());
  weekEnd.setDate(weekEnd.getDate() + 6);

  var weekLabelEl = document.getElementById('staffWeekLabel');
  if (weekLabelEl) weekLabelEl.textContent = weekStart.getDate() + ' ' + MOIS[weekStart.getMonth()] + ' – ' + weekEnd.getDate() + ' ' + MOIS[weekEnd.getMonth()];

  var nextBtn = document.getElementById('staffNextWeekBtn');
  if (nextBtn) nextBtn.disabled = staffWeekOffset >= MAX_WEEKS_AHEAD;

  for (var dayIndex = 0; dayIndex < 7; dayIndex++) {
    var d = new Date(weekStart.getTime());
    d.setDate(weekStart.getDate() + dayIndex);
    var dow = d.getDay();
    var isClosedDay = dow === 0 || dow === 1;
    var isAbsentDay = !!absenceDates[toDateKey(d)];

    var dayCard = document.createElement('div');
    dayCard.className = 'cal-day' + ((isClosedDay || isAbsentDay) ? ' closed' : '');

    var head = document.createElement('div');
    head.className = 'cal-day-head';
    head.innerHTML = JOURS[dow] + '<strong>' + d.getDate() + ' ' + MOIS[d.getMonth()] + '</strong>';
    dayCard.appendChild(head);

    if (isClosedDay || isAbsentDay) {
      var closedLabel = document.createElement('div');
      closedLabel.className = 'cal-day-closed-label';
      closedLabel.textContent = isClosedDay ? 'Fermé' : 'Absent(e)';
      dayCard.appendChild(closedLabel);
      calendarEl.appendChild(dayCard);
      continue;
    }

    var slotsWrap = document.createElement('div');
    slotsWrap.className = 'cal-slots';

    HEURES.forEach(function (heure) {
      var label = JOURS[dow].charAt(0).toUpperCase() + JOURS[dow].slice(1) + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' à ' + heure;
      var booking = bookingsByLabel[label];
      var slotEl = document.createElement('div');
      if (booking) {
        var statusIcon = booking.status === 'attended' ? ' ✓' : (booking.status === 'no_show' ? ' ✗' : '');
        slotEl.className = 'cal-slot busy' + (booking.status === 'no_show' ? ' no-show' : '');
        slotEl.innerHTML = escapeHtml(heure) + statusIcon + '<br>' + escapeHtml(booking.clientPrenom);
        slotEl.title = booking.prestation + ' — ' + booking.clientPrenom + ' (' + booking.clientTelephone + ')' +
          (booking.status === 'attended' ? ' — venu(e)' : (booking.status === 'no_show' ? ' — absent(e)' : ''));
      } else if (absentSlotsByLabel[label]) {
        slotEl.className = 'cal-slot absent-slot';
        slotEl.innerHTML = escapeHtml(heure) + '<br>Absent(e)';
        slotEl.title = 'Créneau bloqué' + (absentSlotsByLabel[label] !== 'Absence' ? ' — ' + absentSlotsByLabel[label] : '');
      } else {
        slotEl.className = 'cal-slot';
        slotEl.textContent = heure;
      }
      slotsWrap.appendChild(slotEl);
    });

    dayCard.appendChild(slotsWrap);
    calendarEl.appendChild(dayCard);
  }
}

function renderBarChart(counts) {
  var container = document.getElementById('statsChart');
  if (!container) return;
  var entries = Object.keys(counts).map(function (k) { return { label: k, count: counts[k] }; });
  entries.sort(function (a, b) { return b.count - a.count; });

  if (!entries.length) { container.innerHTML = ''; return; }

  var barHeight = 26, gap = 12, labelWidth = 150, chartWidth = 240, maxCount = entries[0].count;
  var svgWidth = labelWidth + chartWidth + 40;
  var svgHeight = entries.length * (barHeight + gap);

  var barsSvg = entries.map(function (entry, i) {
    var y = i * (barHeight + gap);
    var barWidth = maxCount > 0 ? (entry.count / maxCount) * chartWidth : 0;
    return '<text x="0" y="' + (y + barHeight / 2 + 4) + '" font-size="12" fill="var(--encre-soft)">' + escapeHtml(entry.label) + '</text>' +
      '<rect x="' + labelWidth + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" rx="3" fill="var(--bordeaux)"></rect>' +
      '<text x="' + (labelWidth + barWidth + 8) + '" y="' + (y + barHeight / 2 + 4) + '" font-size="12" fill="var(--encre)">' + entry.count + '</text>';
  }).join('');

  container.innerHTML = '<svg viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '" width="100%" height="' + svgHeight + '" role="img" aria-label="Nombre de rendez-vous par prestation">' + barsSvg + '</svg>';
}

sb.auth.getSession().then(function (res) {
  if (res.data.session) {
    currentSession = res.data.session;
    checkStaffAndLoad();
  } else {
    renderLoginForm();
  }
});
