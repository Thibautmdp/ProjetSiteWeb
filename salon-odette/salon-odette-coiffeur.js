/*
  ============================================================================
  SALON ODETTE — ESPACE COIFFEUR (emploi du temps + statistiques personnelles)
  ============================================================================

  OBJECTIFS DE CE FICHIER
  - Faire tourner la page salon-odette-espace-coiffeur.html : une page séparée
    du site public, réservée à l'équipe (Odette, Karim, Lina).
  - Vérifier que le compte connecté correspond bien à un coiffeur (table
    `staff` — voir salon-odette-schema.sql), sinon refuser l'accès.
  - Afficher SON PROPRE emploi du temps (les rendez-vous qui lui sont
    assignés, avec le prénom/téléphone du client — pas ceux des autres
    coiffeurs) et quelques statistiques : nombre de RDV à venir / sous 7
    jours / au total, chiffre d'affaires estimé, et la prestation la plus
    demandée avec un petit graphique en barres.

  CONTRAIREMENT AUX AUTRES FICHIERS DU SITE : cette page ne partage PAS son
  espace global avec salon-odette-connexion.js / client.js / reservation.js —
  elle a son propre client Supabase et sa propre logique, complètement
  indépendante, puisqu'elle vit sur une page HTML séparée.

  CE QUI A ÉTÉ FAIT (2026-09-03)
  - Connexion email + mot de passe (mêmes comptes Supabase que le site
    client, mais un compte doit avoir une ligne dans `staff` pour voir le
    tableau de bord — sinon message "Accès non autorisé").
  - Emploi du temps : liste des rendez-vous à venir, avec prénom + téléphone
    du client (autorisé par une règle RLS dédiée : un coiffeur ne voit un
    profil client QUE si ce client a un rendez-vous avec lui).
  - Statistiques : compteurs (à venir / sous 7 jours / total), chiffre
    d'affaires estimé (tarifs approximatifs codés en dur, à rapprocher des
    vrais tarifs du site le jour où ils seront gérés depuis une interface),
    et un graphique en barres (SVG fait main, pas de librairie externe) des
    prestations les plus demandées.
  - "Prochain rendez-vous" mis en avant en haut de page.

  CE QU'IL RESTE À FAIRE / IDÉES POUR LA SUITE
  - Filtrer/naviguer l'emploi du temps par semaine (aujourd'hui, tout est
    affiché à plat, du plus proche au plus lointain).
  - Un vrai espace propriétaire à part (voir la liste complète du projet) :
    vue sur TOUS les coiffeurs à la fois, bloquer des créneaux/jours,
    modifier les tarifs et prestations, gérer l'équipe (créer un compte
    coiffeur directement depuis une interface plutôt qu'à la main dans
    Supabase), suivi des annulations/no-shows.
  - Permettre au coiffeur d'annuler un rendez-vous lui-même (pour l'instant,
    lecture seule — seul le client peut annuler depuis son espace).

  FONCTIONS DE CE FICHIER
  - escapeHtml(str) : échappe un texte avant de l'insérer dans le HTML
    généré (prénom/téléphone client), même logique que escapeAttr ailleurs.
  - renderLoginForm(errorMsg) : dessine le formulaire de connexion (ou un
    message d'erreur au-dessus, ex. mot de passe incorrect).
  - showNotStaffMessage() : affiche "Accès non autorisé" quand le compte
    connecté n'a pas de ligne dans `staff`.
  - checkStaffAndLoad() : vérifie dans `staff` si le compte connecté est un
    coiffeur ; si oui, lance loadBookingsAndRender(), sinon showNotStaffMessage().
  - loadBookingsAndRender() : va chercher tous les rendez-vous assignés à ce
    coiffeur, puis les profils des clients concernés (en deux requêtes
    séparées — bookings.user_id référence auth.users, pas profiles
    directement, donc PostgREST ne peut pas les relier automatiquement),
    les combine, puis appelle renderDashboard().
  - renderDashboard() : construit tout le tableau de bord (prochain RDV,
    compteurs, emploi du temps, statistiques) à partir de myBookings.
  - renderBarChart(counts) : dessine le graphique en barres (SVG) du nombre
    de rendez-vous par prestation.

  DÉPEND DE : rien d'autre que la librairie Supabase (chargée par CDN dans
  salon-odette-espace-coiffeur.html) — voir la remarque ci-dessus, ce fichier
  est volontairement indépendant du reste du site.
  ============================================================================
*/

var SUPABASE_URL = 'https://vyqbbqeskzyromoyxrff.supabase.co';
var SUPABASE_KEY = 'sb_publishable_zR0jfkgIXbfDrLPLxurx7w_QJIDW1t6';
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

var currentSession = null;
var currentStaff = null; // { id, nom }
var myBookings = []; // rendez-vous du coiffeur connecté, avec clientPrenom/clientTelephone ajoutés

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
    sb.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
      if (res.error) {
        status.textContent = 'Email ou mot de passe incorrect.';
        status.hidden = false;
        return;
      }
      currentSession = res.data.session;
      checkStaffAndLoad();
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
  sb.from('staff').select('*').eq('id', currentSession.user.id).maybeSingle().then(function (res) {
    if (res.error || !res.data) {
      showNotStaffMessage();
      return;
    }
    currentStaff = res.data;
    loadBookingsAndRender();
  });
}

function loadBookingsAndRender() {
  sb.from('bookings').select('*').eq('coiffeur', currentStaff.nom).order('appointment_at', { ascending: true }).then(function (bookingsRes) {
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
      var profilesById = {};
      (profilesRes.data || []).forEach(function (p) { profilesById[p.id] = p; });
      myBookings = bookings.map(function (b) {
        var p = profilesById[b.user_id];
        return {
          id: b.id,
          label: b.label,
          prestation: b.prestation,
          appointment_at: b.appointment_at,
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

  var prestationCounts = {};
  myBookings.forEach(function (b) { prestationCounts[b.prestation] = (prestationCounts[b.prestation] || 0) + 1; });
  var topPrestation = Object.keys(prestationCounts).sort(function (a, b) { return prestationCounts[b] - prestationCounts[a]; })[0];

  var estimatedRevenue = myBookings.reduce(function (sum, b) {
    var price = PRESTATION_PRICES[b.prestation];
    return sum + (typeof price === 'number' ? price : 0);
  }, 0);

  var scheduleHtml = upcoming.length
    ? '<div class="booking-list">' + upcoming.map(function (b) {
        return '<div class="booking-list-item">' + escapeHtml(b.label) +
          '<span class="presta">' + escapeHtml(b.prestation) + ' · ' + escapeHtml(b.clientPrenom) + ' (' + escapeHtml(b.clientTelephone) + ')</span>' +
          '</div>';
      }).join('') + '</div>'
    : '<p class="account-empty">Aucun rendez-vous à venir.</p>';

  panel.innerHTML =
    '<div class="staff-header"><h2>Bonjour, ' + escapeHtml(currentStaff.nom) + '</h2><button type="button" id="staffLogoutBtn" class="btn btn-ghost">Se déconnecter</button></div>' +
    (nextBooking
      ? '<p class="next-appt">Prochain rendez-vous : <strong>' + escapeHtml(nextBooking.label) + '</strong> — ' + escapeHtml(nextBooking.prestation) + ' avec ' + escapeHtml(nextBooking.clientPrenom) + '</p>'
      : '<p class="next-appt">Aucun rendez-vous à venir pour l\'instant.</p>') +
    '<div class="stat-cards">' +
      '<div class="stat-card"><div class="stat-num mono">' + upcoming.length + '</div><div class="stat-label">à venir</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + withinWeek.length + '</div><div class="stat-label">sous 7 jours</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + myBookings.length + '</div><div class="stat-label">total (historique inclus)</div></div>' +
      '<div class="stat-card"><div class="stat-num mono">' + estimatedRevenue + '&nbsp;€</div><div class="stat-label">CA estimé</div></div>' +
    '</div>' +
    '<h3 style="margin-top:40px; font-size:1.3rem;">Votre emploi du temps</h3>' +
    scheduleHtml +
    '<h3 style="margin-top:40px; font-size:1.3rem;">Prestations les plus demandées</h3>' +
    (topPrestation ? '<p class="account-sub" style="margin-top:8px;">La plus demandée : <strong>' + escapeHtml(topPrestation) + '</strong> (' + prestationCounts[topPrestation] + ' rendez-vous au total)</p>' : '<p class="account-empty">Pas encore assez de données.</p>') +
    '<div id="statsChart" style="margin-top:12px;"></div>';

  document.getElementById('staffLogoutBtn').addEventListener('click', function () {
    sb.auth.signOut().then(function () {
      currentSession = null;
      currentStaff = null;
      myBookings = [];
      renderLoginForm();
    });
  });

  renderBarChart(prestationCounts);
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
