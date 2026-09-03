/*
  ============================================================================
  SALON ODETTE — RÉSERVATION (calendrier de créneaux + confirmation)
  ============================================================================

  OBJECTIFS DE CE FICHIER
  - Laisser le client choisir un coiffeur (Odette, Karim ou Lina) avant de
    voir son planning — chaque coiffeur a ses propres créneaux disponibles,
    indépendants des deux autres.
  - Afficher le calendrier des 7 prochains jours du coiffeur choisi
    (navigation semaine par semaine), en grisant les jours fermés/passés et
    les créneaux déjà pris CHEZ CE COIFFEUR précisément.
  - Ouvrir la fenêtre de confirmation quand on clique un créneau libre, et
    créer (ou modifier, en mode reprogrammation) la ligne correspondante
    dans la table `bookings`.
  - Gérer le mode "reprogrammation" : quand un client clique "Reprogrammer"
    sur un de ses rendez-vous (depuis salon-odette-client.js), ce fichier
    prend le relais pour qu'il choisisse un nouveau créneau (avec le même
    coiffeur pré-sélectionné, modifiable), et modifie son rendez-vous
    existant au lieu d'en créer un nouveau.

  CE QUI A ÉTÉ FAIT (2026-08-31 / 2026-09-02 / 2026-09-03)
  - Calendrier réel : seuls les jours fermés (lundi, dimanche) et les jours
    passés sont grisés — l'ancienne version grisait des créneaux "complets"
    au hasard (fonction isSlotBooked), supprimée.
  - Créneaux réellement pris affichés barrés pour TOUT LE MONDE (pas
    seulement pour le client qui les a réservés) : buildCalendar() interroge
    la vue publique `booked_slots` (voir salon-odette-schema.sql), qui
    n'expose QUE le texte du créneau et le coiffeur — jamais qui a réservé
    ni quelle prestation, pour ne rien révéler sur les autres clients.
  - Impossible en base qu'un créneau soit réservé deux fois CHEZ LE MÊME
    COIFFEUR (contrainte unique sur bookings.label + coiffeur) — un même
    horaire reste disponible chez un autre coiffeur. Si deux clients
    cliquent presque en même temps chez la même personne, le second voit un
    message clair au lieu d'une erreur silencieuse.
  - Reprogrammation : modifie la ligne existante (UPDATE) plutôt que d'en
    créer une nouvelle ; le calendrier et la liste des RDV se rafraîchissent
    immédiatement après une réservation, une reprogrammation ou une annulation.
  - Sélecteur de coiffeur (3 boutons) au-dessus du calendrier — change le
    coiffeur actif redessine le calendrier avec SES créneaux à lui/elle.

  CE QU'IL RESTE À FAIRE (voir aussi la liste complète du projet)
  - La liste des 3 coiffeurs est encore codée en dur ici (COIFFEURS) — pas de
    vraie table `coiffeurs` en base, puisqu'il n'y a pas encore d'espace
    propriétaire pour gérer l'équipe (ajouter/retirer quelqu'un, horaires
    individuels). À revoir quand salon-odette-coiffeur.js sera construit.
  - Durée variable selon la prestation (une couleur prend plus de temps
    qu'une coupe ; tous les créneaux sont traités pareil aujourd'hui).
  - Liste d'attente quand un jour est complet.

  FONCTIONS DE CE FICHIER
  - getMonday(date) : renvoie le lundi de la semaine d'une date donnée.
  - renderCoiffeurSelector() : dessine les 3 boutons de choix du coiffeur,
    met en avant celui actuellement sélectionné (selectedCoiffeur).
  - renderRescheduleBanner() : affiche/masque le bandeau "Vous reprogrammez
    votre RDV du ..." au-dessus du calendrier, selon reschedulingBooking.
  - closeBookingModal(keepReschedule) : ferme la fenêtre de confirmation.
      Le paramètre keepReschedule évite qu'un simple changement de semaine
      (qui appelle cette fonction pour nettoyer l'affichage) n'annule une
      reprogrammation en cours — seul un vrai clic sur "fermer" (✕, fond
      cliqué, touche Échap) doit l'abandonner.
  - openBookingModal(label) : ouvre la fenêtre de confirmation pour un
    créneau, adapte son titre/bouton selon le mode (réservation ou
    reprogrammation), affiche le coiffeur choisi, et redessine les panneaux
    de compte qu'elle contient.
  - buildCalendar() : récupère la liste des créneaux pris CHEZ LE COIFFEUR
    ACTUELLEMENT SÉLECTIONNÉ (booked_slots filtrée), puis appelle
    renderCalendarGrid() pour dessiner le calendrier.
  - renderCalendarGrid(takenLabels) : construit réellement la grille du
    calendrier (jours, créneaux, état grisé/barré/cliquable).
  - startReschedule(booking) : point d'entrée appelé par salon-odette-client.js
    quand on clique "Reprogrammer" — bascule en mode reprogrammation, pré-
    sélectionne le coiffeur du rendez-vous d'origine, et redessine tout
    (sélecteur + calendrier) avant de faire défiler jusqu'à la réservation.
  - completePendingBooking() : au clic sur "Confirmer" — crée une nouvelle
    ligne dans `bookings`, ou modifie la ligne existante si on est en train
    de reprogrammer. Gère le message si le créneau vient d'être pris entre
    temps par quelqu'un d'autre (code Postgres 23505).

  DÉPEND DE (définies dans d'autres fichiers — un seul espace global partagé
  entre tous les fichiers du site, voir la remarque dans salon-odette-connexion.js) :
  - sb, currentSession           → salon-odette-connexion.js
  - renderAllAccountPanels()     → salon-odette-client.js (appelée à l'ouverture
    de la fenêtre de confirmation, pour afficher connexion/profil à jour dedans)

  FOURNIT AUX AUTRES FICHIERS
  - selectedSlot, reschedulingBooking, COIFFEURS, selectedCoiffeur
  - buildCalendar(), closeBookingModal(), renderRescheduleBanner(),
    completePendingBooking(), startReschedule(booking)

  ORDRE DE CHARGEMENT IMPORTANT : ce fichier doit être chargé APRÈS
  salon-odette-connexion.js — buildCalendar() est appelée immédiatement à la
  fin de ce fichier et a besoin que `sb` existe déjà.
  ============================================================================
*/

var JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
var HEURES = ['9h00', '10h00', '11h00', '14h00', '15h00', '16h00', '17h00'];

// Liste fixe pour l'instant (voir "reste à faire" en tête de fichier).
var COIFFEURS = ['Odette', 'Karim', 'Lina'];
var selectedCoiffeur = COIFFEURS[0];

var selectedSlot = null; // { label, appointmentAt, coiffeur }
var reschedulingBooking = null; // { id, label, prestation, coiffeur } — RDV en cours de reprogrammation, ou null
var weekOffset = 0;
var MAX_WEEKS_AHEAD = 7;

// Code Postgres renvoyé par Supabase quand la contrainte d'unicité sur bookings.label +
// coiffeur est violée — c'est-à-dire quand quelqu'un d'autre vient de prendre ce créneau
// chez ce même coiffeur (un autre coiffeur, lui, aurait pu rester libre à cette heure-là).
var SLOT_TAKEN_ERROR_CODE = '23505';

function getMonday(date) {
  var d = new Date(date.getTime());
  var day = d.getDay();
  var diff = (day === 0 ? -6 : 1 - day); // recule jusqu'au lundi
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function renderCoiffeurSelector() {
  var wrap = document.getElementById('coiffeurSelector');
  if (!wrap) return;
  wrap.innerHTML = COIFFEURS.map(function (nom) {
    var active = nom === selectedCoiffeur;
    return '<button type="button" class="btn ' + (active ? 'btn-primary' : 'btn-ghost') + '" data-coiffeur="' + nom + '">' + nom + '</button>';
  }).join('');
  wrap.querySelectorAll('button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var nom = btn.getAttribute('data-coiffeur');
      if (nom === selectedCoiffeur) return;
      selectedCoiffeur = nom;
      renderCoiffeurSelector();
      buildCalendar();
    });
  });
}

function renderRescheduleBanner() {
  var banner = document.getElementById('rescheduleBanner');
  if (!banner) return;
  if (!reschedulingBooking) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  banner.hidden = false;
  banner.innerHTML = 'Vous reprogrammez votre rendez-vous <strong>' + reschedulingBooking.label + '</strong>' +
    (reschedulingBooking.coiffeur ? ' avec <strong>' + reschedulingBooking.coiffeur + '</strong>' : '') +
    ' — choisissez un nouveau créneau ci-dessous (vous pouvez aussi changer de coiffeur), ou ' +
    '<button type="button" id="cancelRescheduleBtn" class="booking-action-btn" style="color:inherit;">annulez la reprogrammation</button>.';
  var cancelBtn = document.getElementById('cancelRescheduleBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', function () {
    reschedulingBooking = null;
    renderRescheduleBanner();
  });
}

// keepReschedule: true quand appelé juste pour un rafraîchissement visuel (ex. changement de
// semaine) — sans ça, changer de semaine en pleine reprogrammation annulerait celle-ci.
function closeBookingModal(keepReschedule) {
  var modal = document.getElementById('bookingModal');
  if (modal) modal.hidden = true;
  var calendarEl = document.getElementById('calendar');
  if (calendarEl) calendarEl.querySelectorAll('.cal-slot.selected').forEach(function (el) { el.classList.remove('selected'); });
  selectedSlot = null;
  if (!keepReschedule) {
    reschedulingBooking = null;
    renderRescheduleBanner();
  }
}

function openBookingModal(label) {
  var modal = document.getElementById('bookingModal');
  var slotLabelEl = document.getElementById('confirmSlotLabel');
  var modalTitleEl = document.getElementById('modalTitle');
  if (slotLabelEl) slotLabelEl.textContent = label + ' — avec ' + selectedCoiffeur;
  if (modalTitleEl) modalTitleEl.textContent = reschedulingBooking ? 'Reprogrammer votre rendez-vous' : 'Confirmer votre créneau';
  var prestationSelect = document.getElementById('c-prestation');
  if (prestationSelect && reschedulingBooking) prestationSelect.value = reschedulingBooking.prestation;
  if (modal) {
    modal.hidden = false;
    var dialog = modal.querySelector('.modal-dialog');
    if (dialog) dialog.scrollTop = 0;
  }
  renderAllAccountPanels();
}

function buildCalendar() {
  var calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
  // "booked_slots" est une vue publique qui n'expose que le texte du créneau (label) et
  // le coiffeur concerné, rien d'autre — voir salon-odette-schema.sql. On ne regarde que
  // les créneaux pris CHEZ LE COIFFEUR ACTUELLEMENT SÉLECTIONNÉ : un horaire pris chez
  // un autre coiffeur n'a aucune raison de griser celui-ci.
  sb.from('booked_slots').select('label').eq('coiffeur', selectedCoiffeur).then(function (res) {
    var takenLabels = {};
    (res.error ? [] : (res.data || [])).forEach(function (row) { takenLabels[row.label] = true; });
    if (res.error) console.error(res.error);
    renderCalendarGrid(takenLabels);
  });
}

function renderCalendarGrid(takenLabels) {
  var calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
  calendarEl.innerHTML = '';
  closeBookingModal(true);

  var monday = getMonday(new Date());
  var weekStart = new Date(monday.getTime());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  var weekEnd = new Date(weekStart.getTime());
  weekEnd.setDate(weekEnd.getDate() + 6);

  var weekLabelEl = document.getElementById('weekLabel');
  if (weekLabelEl) {
    weekLabelEl.textContent = weekStart.getDate() + ' ' + MOIS[weekStart.getMonth()] + ' – ' + weekEnd.getDate() + ' ' + MOIS[weekEnd.getMonth()];
  }
  var prevBtn = document.getElementById('prevWeekBtn');
  var nextBtn = document.getElementById('nextWeekBtn');
  if (prevBtn) prevBtn.disabled = weekOffset <= 0;
  if (nextBtn) nextBtn.disabled = weekOffset >= MAX_WEEKS_AHEAD;

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  for (var dayIndex = 0; dayIndex < 7; dayIndex++) {
    var d = new Date(weekStart.getTime());
    d.setDate(weekStart.getDate() + dayIndex);
    var dow = d.getDay();
    var isClosedDay = dow === 0 || dow === 1;
    var isPastDay = d.getTime() < today.getTime();

    var dayCard = document.createElement('div');
    dayCard.className = 'cal-day' + (isClosedDay || isPastDay ? ' closed' : '');

    var head = document.createElement('div');
    head.className = 'cal-day-head';
    head.innerHTML = JOURS[dow] + '<strong>' + d.getDate() + ' ' + MOIS[d.getMonth()] + '</strong>';
    dayCard.appendChild(head);

    if (isClosedDay || isPastDay) {
      var closedLabel = document.createElement('div');
      closedLabel.className = 'cal-day-closed-label';
      closedLabel.textContent = isPastDay ? 'Passé' : 'Fermé';
      dayCard.appendChild(closedLabel);
      calendarEl.appendChild(dayCard);
      continue;
    }

    var slotsWrap = document.createElement('div');
    slotsWrap.className = 'cal-slots';

    HEURES.forEach(function (heure) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-slot';
      btn.textContent = heure;
      var label = JOURS[dow].charAt(0).toUpperCase() + JOURS[dow].slice(1) + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' à ' + heure;

      // Date/heure réelle du créneau (ex. "9h00" → 9), utilisée pour savoir plus tard
      // si ce RDV est passé ou à venir (historique côté espace client). parseInt
      // s'arrête au premier caractère non numérique, donc "14h00" → 14.
      var slotDate = new Date(d.getTime());
      slotDate.setHours(parseInt(heure, 10), 0, 0, 0);
      var appointmentAtIso = slotDate.toISOString();

      if (takenLabels[label]) {
        btn.classList.add('booked');
        btn.disabled = true;
        btn.setAttribute('aria-label', label + ' — complet');
      } else {
        btn.setAttribute('aria-label', label + ' — disponible');
        btn.addEventListener('click', function () {
          calendarEl.querySelectorAll('.cal-slot.selected').forEach(function (el) { el.classList.remove('selected'); });
          btn.classList.add('selected');
          selectedSlot = { label: label, appointmentAt: appointmentAtIso, coiffeur: selectedCoiffeur };
          openBookingModal(label);
        });
      }
      slotsWrap.appendChild(btn);
    });

    dayCard.appendChild(slotsWrap);
    calendarEl.appendChild(dayCard);
  }
}
renderCoiffeurSelector();
buildCalendar();

var prevWeekBtn = document.getElementById('prevWeekBtn');
var nextWeekBtn = document.getElementById('nextWeekBtn');
if (prevWeekBtn) {
  prevWeekBtn.addEventListener('click', function () {
    if (weekOffset > 0) { weekOffset--; buildCalendar(); }
  });
}
if (nextWeekBtn) {
  nextWeekBtn.addEventListener('click', function () {
    if (weekOffset < MAX_WEEKS_AHEAD) { weekOffset++; buildCalendar(); }
  });
}

function completePendingBooking() {
  if (!selectedSlot || !currentSession) return;
  var prestation = document.getElementById('c-prestation').value;

  if (reschedulingBooking) {
    sb.from('bookings').update({
      label: selectedSlot.label,
      prestation: prestation,
      appointment_at: selectedSlot.appointmentAt,
      coiffeur: selectedSlot.coiffeur
    }).eq('id', reschedulingBooking.id).then(function (res) {
      if (res.error) {
        if (res.error.code === SLOT_TAKEN_ERROR_CODE) {
          window.alert('Ce créneau vient d\'être pris par quelqu\'un d\'autre — merci d\'en choisir un autre.');
        } else {
          window.alert('Erreur lors de la reprogrammation : ' + res.error.message);
        }
        return;
      }
      reschedulingBooking = null;
      renderRescheduleBanner();
      closeBookingModal(true);
      refreshAndRenderAll();
      buildCalendar();
    });
    return;
  }

  sb.from('bookings').insert({
    user_id: currentSession.user.id,
    label: selectedSlot.label,
    prestation: prestation,
    appointment_at: selectedSlot.appointmentAt,
    coiffeur: selectedSlot.coiffeur
  }).then(function (res) {
    if (res.error) {
      if (res.error.code === SLOT_TAKEN_ERROR_CODE) {
        window.alert('Ce créneau vient d\'être réservé par quelqu\'un d\'autre — merci d\'en choisir un autre.');
      } else {
        window.alert('Erreur lors de la réservation : ' + res.error.message);
      }
      return;
    }
    closeBookingModal();
    refreshAndRenderAll();
    buildCalendar();
  });
}

// Appelée par salon-odette-client.js quand le client clique "Reprogrammer" sur un de ses
// rendez-vous. Pré-sélectionne le coiffeur d'origine (modifiable ensuite) pour que le
// calendrier affiché corresponde bien au bon planning dès le départ.
function startReschedule(booking) {
  reschedulingBooking = { id: booking.id, label: booking.label, prestation: booking.prestation, coiffeur: booking.coiffeur };
  if (booking.coiffeur && COIFFEURS.indexOf(booking.coiffeur) !== -1) {
    selectedCoiffeur = booking.coiffeur;
  }
  closeBookingModal(true);
  renderRescheduleBanner();
  renderCoiffeurSelector();
  buildCalendar();
  window.location.hash = 'reserver';
}

var modalCloseBtn = document.getElementById('modalCloseBtn');
var bookingModalEl = document.getElementById('bookingModal');
if (modalCloseBtn) modalCloseBtn.addEventListener('click', function () { closeBookingModal(); });
if (bookingModalEl) {
  bookingModalEl.addEventListener('click', function (e) {
    if (e.target === bookingModalEl) closeBookingModal();
  });
}
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && bookingModalEl && !bookingModalEl.hidden) closeBookingModal();
});
