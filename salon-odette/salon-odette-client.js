/*
  ============================================================================
  SALON ODETTE — ESPACE CLIENT (profil, ses infos, ses rendez-vous)
  ============================================================================

  OBJECTIFS DE CE FICHIER
  - Charger et garder à jour les données du client connecté : son profil
    (prénom/téléphone/email de contact) et la liste de ses rendez-vous.
  - Afficher cette vue "compte" une fois qu'on sait que la personne est
    pleinement connectée (session + profil trouvés) : bonjour + infos,
    bouton pour modifier ses infos, liste des rendez-vous à venir avec
    "Reprogrammer" / "Annuler" sur chacun, bouton de déconnexion.
  - Fournir le formulaire "Modifier mes infos" (prénom/téléphone/email de
    contact — pas l'email de connexion, volontairement laissé de côté, voir
    salon-odette-connexion.js).

  CE QUI A ÉTÉ FAIT (2026-09-02 / 2026-09-03)
  - "Modifier mes infos" : formulaire pré-rempli, enregistre dans `profiles`.
  - Liste des rendez-vous À VENIR avec, pour chacun :
      - "Annuler" → supprime la ligne dans `bookings` (avec confirmation),
        et enregistre une trace dans `cancellations` (coiffeur/prestation/
        date, jamais l'identité du client) pour les statistiques du coiffeur
        concerné — voir salon-odette-coiffeur.js. Le créneau redevient
        immédiatement libre, seule la trace persiste.
      - "Reprogrammer" → passe la main à salon-odette-reservation.js pour
        choisir un nouveau créneau, qui viendra modifier ce même rendez-vous
        au lieu d'en créer un nouveau.
  - Historique des rendez-vous PASSÉS : les RDV sont séparés en deux listes
    grâce à la colonne `appointment_at` (vraie date/heure du créneau, écrite
    par salon-odette-reservation.js) comparée à l'instant présent — au lieu
    de tout mélanger dans une seule liste comme avant. L'historique est
    replié par défaut (élément <details>) et sans boutons d'action : on ne
    peut pas annuler/reprogrammer un rendez-vous déjà passé. Les anciennes
    lignes créées avant l'ajout de cette colonne (appointment_at = null)
    sont traitées comme "à venir" par défaut, pour ne rien cacher par erreur.
  - N'apparaît que dans l'espace client de la page (pas dans la fenêtre de
    réservation, pour ne pas l'encombrer pendant qu'on confirme un créneau).

  CE QUI A ÉTÉ FAIT (2026-09-03, suite)
  - Chaque rendez-vous affiche désormais le coiffeur choisi (ex. "Coupe homme
    · Karim"), en plus de la prestation — voir salon-odette-reservation.js
    pour la logique de choix du coiffeur et son planning indépendant.
  - "Reprogrammer" passe maintenant par startReschedule() (défini dans
    salon-odette-reservation.js) plutôt que de manipuler reschedulingBooking
    directement ici — ça permet au calendrier de pré-sélectionner le bon
    coiffeur dès l'ouverture, sans dupliquer cette logique dans ce fichier.

  CE QU'IL RESTE À FAIRE
  - Recevoir une confirmation par email/SMS après réservation, et un rappel
    avant le rendez-vous (J-1) — nécessite un service tiers d'envoi.

  FONCTIONS DE CE FICHIER
  - escapeAttr(str)
      Échappe une valeur avant de l'insérer dans un attribut HTML
      (value="..."), pour éviter qu'un prénom/email contenant des guillemets
      ne casse le HTML généré.
  - renderClientAccount(panel, ids, isModalPanel, prefix)
      Dessine soit le formulaire "Modifier mes infos" (si editingProfile[prefix]
      est vrai), soit la vue normale (bonjour + infos + rendez-vous + actions).
      Appelée uniquement par renderAccountInto() une fois que session ET
      profil existent — voir salon-odette-connexion.js.
  - renderAllAccountPanels()
      Redessine les deux emplacements du site qui montrent le compte client
      (l'espace client de la page, et le panneau dans la fenêtre de réservation).
  - loadUserData()
      Va chercher en base le profil et les rendez-vous du client connecté
      (ou vide currentProfile/currentBookings si personne n'est connecté).
  - refreshAndRenderAll()
      Enchaîne loadUserData() puis renderAllAccountPanels() — la fonction à
      appeler après toute action qui change les données du compte ou des RDV.

  DÉPEND DE (définies dans d'autres fichiers — un seul espace global partagé
  entre tous les fichiers du site, voir la remarque dans salon-odette-connexion.js) :
  - sb, currentSession                                      → salon-odette-connexion.js
  - selectedSlot, reschedulingBooking, closeBookingModal(),
    completePendingBooking(), buildCalendar(), startReschedule(booking)
                                                              → salon-odette-reservation.js
  - renderAccountInto()                                      → salon-odette-connexion.js
    (renderAllAccountPanels l'appelle pour chaque emplacement)

  FOURNIT AUX AUTRES FICHIERS
  - currentProfile, currentBookings, editingProfile
  - renderClientAccount(), renderAllAccountPanels(), loadUserData(), refreshAndRenderAll()
  ============================================================================
*/

var currentProfile = null;
var currentBookings = [];
var editingProfile = { m: false, s: false };

function escapeAttr(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderClientAccount(panel, ids, isModalPanel, prefix) {
  if (editingProfile[prefix]) {
    panel.innerHTML =
      '<h3>Modifier mes informations</h3>' +
      '<p class="account-sub">Email de connexion (' + currentSession.user.email + ') non modifiable ici.</p>' +
      '<div class="field"><label for="' + ids.prenom + '">Prénom</label><input type="text" id="' + ids.prenom + '" value="' + escapeAttr(currentProfile.prenom) + '"></div>' +
      '<div class="field"><label for="' + ids.tel + '">Téléphone</label><input type="tel" id="' + ids.tel + '" value="' + escapeAttr(currentProfile.telephone) + '"></div>' +
      '<div class="field"><label for="' + ids.email + '">Email de contact</label><input type="email" id="' + ids.email + '" value="' + escapeAttr(currentProfile.email || '') + '"></div>' +
      '<div class="form-actions">' +
        '<button type="button" id="' + ids.createBtn + '" class="btn btn-primary">Enregistrer</button>' +
        '<button type="button" id="' + ids.forgetBtn + '" class="btn btn-ghost">Annuler</button>' +
      '</div>' +
      '<p id="' + ids.loginStatus + '" class="login-alert" hidden></p>';

    panel.querySelector('#' + ids.createBtn).addEventListener('click', function () {
      var prenom = panel.querySelector('#' + ids.prenom).value.trim();
      var tel = panel.querySelector('#' + ids.tel).value.trim();
      var email = panel.querySelector('#' + ids.email).value.trim();
      var loginStatus = panel.querySelector('#' + ids.loginStatus);
      if (!prenom || !tel) {
        loginStatus.textContent = 'Merci de remplir prénom et téléphone.';
        loginStatus.hidden = false;
        return;
      }
      sb.from('profiles').update({ prenom: prenom, telephone: tel, email: email }).eq('id', currentSession.user.id).then(function (res) {
        if (res.error) {
          loginStatus.textContent = 'Erreur : ' + res.error.message;
          loginStatus.hidden = false;
          return;
        }
        editingProfile[prefix] = false;
        refreshAndRenderAll();
      });
    });
    panel.querySelector('#' + ids.forgetBtn).addEventListener('click', function () {
      editingProfile[prefix] = false;
      renderAllAccountPanels();
    });
    return;
  }

  // Un RDV sans appointment_at (créé avant l'ajout de cette colonne) est traité comme
  // "à venir" par défaut, pour ne jamais le faire disparaître silencieusement dans
  // l'historique par erreur.
  var now = Date.now();
  var upcomingBookings = currentBookings.filter(function (b) {
    return !b.appointment_at || new Date(b.appointment_at).getTime() >= now;
  });
  var pastBookings = currentBookings.filter(function (b) {
    return b.appointment_at && new Date(b.appointment_at).getTime() < now;
  }).reverse(); // le rendez-vous passé le plus récent en premier

  // "Coiffeur non précisé" ne devrait apparaître que sur d'anciens RDV créés avant
  // l'ajout de cette colonne (voir salon-odette-schema.sql).
  function prestaEtCoiffeur(b) {
    return b.prestation + ' · ' + (b.coiffeur || 'coiffeur non précisé');
  }

  var bookingsHtml = upcomingBookings.length
    ? '<div class="booking-list">' + upcomingBookings.map(function (b) {
        return '<div class="booking-list-item">' +
          '<div><span>' + b.label + '</span> <span class="presta">' + prestaEtCoiffeur(b) + '</span></div>' +
          '<div class="booking-actions">' +
            '<button type="button" class="booking-action-btn" data-action="reschedule" data-id="' + b.id + '">Reprogrammer</button>' +
            '<button type="button" class="booking-action-btn" data-action="cancel" data-id="' + b.id + '">Annuler</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>'
    : '<p class="account-empty">Aucun rendez-vous prévu pour l\'instant.</p>';

  // L'historique n'apparaît que dans l'espace client de la page, pas dans la fenêtre
  // de réservation (isModalPanel) — pas utile pendant qu'on confirme un nouveau créneau.
  var historyHtml = '';
  if (!isModalPanel) {
    var pastListHtml = pastBookings.length
      ? '<div class="booking-list">' + pastBookings.map(function (b) {
          return '<div class="booking-list-item"><div><span>' + b.label + '</span> <span class="presta">' + prestaEtCoiffeur(b) + '</span></div></div>';
        }).join('') + '</div>'
      : '<p class="account-empty">Aucun rendez-vous passé pour l\'instant.</p>';
    historyHtml =
      '<details class="history-details" style="margin-top:20px;">' +
        '<summary>Historique des rendez-vous passés (' + pastBookings.length + ')</summary>' +
        '<div style="margin-top:12px;">' + pastListHtml + '</div>' +
      '</details>';
  }

  panel.innerHTML =
    '<h3>Bonjour, ' + currentProfile.prenom + '</h3>' +
    '<p class="account-sub">Compte connecté (' + currentSession.user.email + ').</p>' +
    '<div class="profile-row"><span class="label">Téléphone</span><span>' + currentProfile.telephone + '</span></div>' +
    (currentProfile.email ? '<div class="profile-row"><span class="label">Email</span><span>' + currentProfile.email + '</span></div>' : '') +
    (isModalPanel && selectedSlot ? '<div class="form-actions" style="margin-top:18px;"><button type="button" id="' + ids.confirmBtn + '" class="btn btn-primary">' + (reschedulingBooking ? 'Confirmer le nouveau créneau' : 'Confirmer le rendez-vous') + '</button></div>' : '') +
    '<div style="margin-top:20px;"><strong style="font-size:0.9rem;">Vos rendez-vous à venir</strong>' + bookingsHtml + '</div>' +
    historyHtml +
    (!isModalPanel ? '<div class="form-actions" style="margin-top:20px;"><a href="#reserver" class="btn btn-primary">Réserver un nouveau créneau</a></div>' : '') +
    '<div class="form-actions" style="margin-top:16px;"><button type="button" id="' + ids.editBtn + '" class="btn btn-ghost">Modifier mes infos</button></div>' +
    '<button type="button" class="account-forget" id="' + ids.forgetBtn + '">Se déconnecter</button>';

  panel.querySelector('#' + ids.editBtn).addEventListener('click', function () {
    editingProfile[prefix] = true;
    renderAllAccountPanels();
  });
  panel.querySelector('#' + ids.forgetBtn).addEventListener('click', function () {
    sb.auth.signOut();
  });
  if (isModalPanel) {
    var confirmBtn = panel.querySelector('#' + ids.confirmBtn);
    if (confirmBtn) confirmBtn.addEventListener('click', completePendingBooking);
  }
  panel.querySelectorAll('.booking-action-btn').forEach(function (btn) {
    var bookingId = btn.getAttribute('data-id');
    var action = btn.getAttribute('data-action');
    btn.addEventListener('click', function () {
      if (action === 'cancel') {
        if (!window.confirm('Annuler ce rendez-vous ?')) return;
        var cancelledBooking = currentBookings.filter(function (b) { return b.id === bookingId; })[0];
        sb.from('bookings').delete().eq('id', bookingId).then(function (res) {
          if (res.error) { window.alert('Erreur : ' + res.error.message); return; }
          // Trace de l'annulation pour les statistiques coiffeur (voir salon-odette-coiffeur.js)
          // — best-effort, on ne bloque pas l'annulation si cet enregistrement échoue.
          if (cancelledBooking && cancelledBooking.coiffeur) {
            sb.from('cancellations').insert({
              coiffeur: cancelledBooking.coiffeur,
              prestation: cancelledBooking.prestation,
              appointment_at: cancelledBooking.appointment_at,
              cancelled_by: currentSession.user.id
            }).then(function (cancelRes) {
              if (cancelRes.error) console.error(cancelRes.error);
            });
          }
          refreshAndRenderAll();
          buildCalendar();
        });
      } else if (action === 'reschedule') {
        var booking = currentBookings.filter(function (b) { return b.id === bookingId; })[0];
        if (!booking) return;
        startReschedule(booking);
      }
    });
  });
}

function renderAllAccountPanels() {
  renderAccountInto(document.getElementById('accountPanel'), 'm');
  renderAccountInto(document.getElementById('clientSpacePanel'), 's');
}

function loadUserData() {
  if (!currentSession) {
    currentProfile = null;
    currentBookings = [];
    return Promise.resolve();
  }
  var uid = currentSession.user.id;
  return Promise.all([
    sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
    sb.from('bookings').select('*').eq('user_id', uid).order('appointment_at', { ascending: true, nullsFirst: false })
  ]).then(function (results) {
    currentProfile = results[0].data || null;
    currentBookings = results[1].data || [];
  });
}

function refreshAndRenderAll() {
  return loadUserData().then(renderAllAccountPanels);
}
