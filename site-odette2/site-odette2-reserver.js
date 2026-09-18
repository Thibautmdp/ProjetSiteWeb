/*
  ============================================================================
  SALON ODETTE — RÉSERVATION EN 3 ÉTAPES (dossier site-odette2/, page dédiée
  site-odette2-reserver.html)
  ============================================================================

  OBJECTIFS DE CE FICHIER
  - Faire tourner site-odette2-reserver.html : un parcours guidé en 3 étapes
    (qui vous coiffe d'habitude → quel type de coupe → quel créneau, avec les
    disponibilités de CE coiffeur précisément), plutôt que le calendrier en
    pleine page de la version originale (salon-odette/salon-odette-
    reservation.js).
  - Gérer aussi la reprogrammation d'un rendez-vous existant, arrivée via
    ?reschedule=<id> dans l'URL (lien envoyé par le bouton "Reprogrammer" de
    l'espace client sur site-odette2.html).

  NE MODIFIE PAS salon-odette/salon-odette-reservation.js (version originale,
  intacte, dans son propre dossier) — ce fichier est une page/logique séparée,
  recopiée puis adaptée, PAS un import ni une modification en place.

  CE QUE CE FICHIER RÉUTILISE SANS Y TOUCHER
  - site-odette2-connexion.js (sb, currentSession, renderAccountInto) et
    site-odette2-client.js (renderClientAccount, refreshAndRenderAll,
    renderAllAccountPanels) — copies de salon-odette-connexion.js/client.js
    (voir commentaire en tête de site-odette2.html pour le pourquoi), chargées
    avant ce script. Ces deux fichiers ne savent rien de la mise en page : ils
    cherchent juste un élément d'id "accountPanel" (présent ici, à la fin de
    l'étape 3) et lisent quelques variables globales par leur nom
    (selectedSlot, reschedulingBooking, completePendingBooking) — peu importe
    quel fichier les définit. Ce fichier les définit comme le faisait
    salon-odette-reservation.js, ce qui suffit à faire marcher le panneau de
    compte ici sans aucune modification de connexion.js/client.js.

  FONCTIONS DE CE FICHIER
  - goToStep(n) : affiche l'étape n, masque les autres, met à jour
    l'indicateur d'étapes en haut de page.
  - renderCoiffeurCards() / renderPrestationCards() : dessinent les cartes
    sélectionnables des étapes 1 et 2.
  - buildCalendar() / renderCalendarGrid(takenLabels) : identique dans l'esprit
    à la version originale (créneaux pris chez CE coiffeur, via la vue
    publique booked_slots), adapté à cette page (pas de sélecteur de coiffeur
    ici, il est déjà fixé par l'étape 1).
  - onSlotClick(label, appointmentAtIso) : mémorise le créneau choisi, révèle
    le panneau de confirmation (compte/connexion), redessine les panneaux de
    compte.
  - completePendingBooking() : crée la ligne dans bookings, ou la modifie si
    reschedulingBooking est défini — même logique que l'originale, sauf que la
    prestation vient de l'étape 2 (variable) et non d'un <select> dans une
    fenêtre modale.
  - loadRescheduleFromUrl() : si l'URL contient ?reschedule=<id>, va chercher
    ce rendez-vous (l'utilisateur doit déjà être connecté — RLS oblige) et
    pré-sélectionne son coiffeur/sa prestation (modifiables) + affiche le
    bandeau de reprogrammation.

  CE QUI A ÉTÉ FAIT (2026-09-18)
  - Correction bug : même correctif que salon-odette-reservation.js — un
    créneau du jour même déjà passé n'est plus cliquable (isPastSlot en plus
    de isPastDay).

  CE QU'IL RESTE À FAIRE
  - Comme sur l'originale : durée variable selon la prestation, liste
    d'attente quand un jour est complet.
  ============================================================================
*/

var COIFFEURS = ['Odette', 'Karim', 'Lina'];
var COIFFEUR_INFO = {
  'Odette': { lettre: 'O', role: 'Fondatrice & coloriste', bg: 'var(--bordeaux)', fg: 'var(--bordeaux-contrast)' },
  'Karim': { lettre: 'K', role: 'Coupe homme & barbe', bg: 'var(--laiton)', fg: 'var(--laiton-contrast)' },
  'Lina': { lettre: 'L', role: 'Coupe femme & coiffure événementielle', bg: 'var(--encre)', fg: 'var(--ivoire)' }
};
var PRESTATIONS = [
  { nom: 'Coupe femme', prix: '48 €' },
  { nom: 'Coupe homme', prix: '26 €' },
  { nom: 'Couleur', prix: '68 €' },
  { nom: 'Balayage / mèches', prix: 'dès 85 €' },
  { nom: 'Coiffage événement', prix: 'dès 60 €' },
  { nom: 'Autre', prix: 'sur devis' }
];
var JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
var HEURES = ['9h00', '10h00', '11h00', '14h00', '15h00', '16h00', '17h00'];
var SLOT_TAKEN_ERROR_CODE = '23505';
var MAX_WEEKS_AHEAD = 7;

var currentStep = 1;
var selectedCoiffeur = null;
var selectedPrestation = null;
var selectedSlot = null; // { label, appointmentAt, coiffeur } — même contrat que sur l'originale
var reschedulingBooking = null; // { id, label, prestation, coiffeur } — ou null
var weekOffset = 0;

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function goToStep(n) {
  currentStep = n;
  [1, 2, 3].forEach(function (i) {
    var section = document.getElementById('step' + i);
    if (section) section.hidden = (i !== n);
  });
  document.querySelectorAll('.step-dot').forEach(function (dot) {
    var step = parseInt(dot.getAttribute('data-step'), 10);
    dot.classList.toggle('active', step === n);
    dot.classList.toggle('done', step < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCoiffeurCards() {
  var wrap = document.getElementById('coiffeurCards');
  if (!wrap) return;
  wrap.innerHTML = COIFFEURS.map(function (nom) {
    var info = COIFFEUR_INFO[nom];
    var selected = nom === selectedCoiffeur;
    return '<button type="button" class="option-card' + (selected ? ' selected' : '') + '" data-coiffeur="' + escapeHtml(nom) + '">' +
      '<div class="avatar" style="background:' + info.bg + '; color:' + info.fg + ';">' + info.lettre + '</div>' +
      '<h3>' + escapeHtml(nom) + '</h3><p>' + escapeHtml(info.role) + '</p>' +
      '</button>';
  }).join('');
  wrap.querySelectorAll('.option-card').forEach(function (card) {
    card.addEventListener('click', function () {
      selectedCoiffeur = card.getAttribute('data-coiffeur');
      renderCoiffeurCards();
      goToStep(2);
    });
  });
}

function renderPrestationCards() {
  var wrap = document.getElementById('prestationCards');
  if (!wrap) return;
  wrap.innerHTML = PRESTATIONS.map(function (p) {
    var selected = p.nom === selectedPrestation;
    return '<button type="button" class="option-card' + (selected ? ' selected' : '') + '" data-prestation="' + escapeHtml(p.nom) + '">' +
      '<h3>' + escapeHtml(p.nom) + '</h3><p class="mono">' + escapeHtml(p.prix) + '</p>' +
      '</button>';
  }).join('');
  wrap.querySelectorAll('.option-card').forEach(function (card) {
    card.addEventListener('click', function () {
      selectedPrestation = card.getAttribute('data-prestation');
      renderPrestationCards();
      document.getElementById('step3CoiffeurName').textContent = selectedCoiffeur;
      goToStep(3);
      buildCalendar();
    });
  });
}

function getMonday(date) {
  var d = new Date(date.getTime());
  var day = d.getDay();
  var diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildCalendar() {
  var calendarEl = document.getElementById('calendar');
  if (!calendarEl || !selectedCoiffeur) return;
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
  hideConfirmPanel();

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

      var slotDate = new Date(d.getTime());
      slotDate.setHours(parseInt(heure, 10), 0, 0, 0);
      var appointmentAtIso = slotDate.toISOString();
      // isPastDay ne grise que les jours entièrement passés — un créneau du jour même
      // dont l'heure est déjà passée doit aussi être bloqué ici, sinon on peut réserver
      // "aujourd'hui 9h00" à 16h.
      var isPastSlot = slotDate.getTime() < Date.now();

      if (takenLabels[label] || isPastSlot) {
        btn.classList.add('booked');
        btn.disabled = true;
        btn.setAttribute('aria-label', label + (takenLabels[label] ? ' — complet' : ' — passé'));
      } else {
        btn.setAttribute('aria-label', label + ' — disponible');
        btn.addEventListener('click', function () {
          calendarEl.querySelectorAll('.cal-slot.selected').forEach(function (el) { el.classList.remove('selected'); });
          btn.classList.add('selected');
          onSlotClick(label, appointmentAtIso);
        });
      }
      slotsWrap.appendChild(btn);
    });

    dayCard.appendChild(slotsWrap);
    calendarEl.appendChild(dayCard);
  }
}

function hideConfirmPanel() {
  var panel = document.getElementById('confirmPanel');
  if (panel) panel.hidden = true;
  selectedSlot = null;
}

function onSlotClick(label, appointmentAtIso) {
  selectedSlot = { label: label, appointmentAt: appointmentAtIso, coiffeur: selectedCoiffeur };
  var panel = document.getElementById('confirmPanel');
  var slotLabelEl = document.getElementById('confirmSlotLabel');
  if (slotLabelEl) slotLabelEl.textContent = label + ' — avec ' + selectedCoiffeur;
  if (panel) {
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  renderAllAccountPanels();
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
  banner.innerHTML = 'Vous reprogrammez votre rendez-vous <strong>' + escapeHtml(reschedulingBooking.label) + '</strong>' +
    (reschedulingBooking.coiffeur ? ' avec <strong>' + escapeHtml(reschedulingBooking.coiffeur) + '</strong>' : '') +
    ' — choisissez un nouveau coiffeur, un nouveau type de coupe et un nouveau créneau ci-dessous si besoin.';
}

function completePendingBooking() {
  if (!selectedSlot || !currentSession) return;
  var prestation = selectedPrestation;

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
      window.location.href = 'site-odette2.html#compte';
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
    window.location.href = 'site-odette2.html#compte';
  });
}

function loadRescheduleFromUrl() {
  var id = new URLSearchParams(window.location.search).get('reschedule');
  if (!id) return;
  sb.from('bookings').select('*').eq('id', id).maybeSingle().then(function (res) {
    if (res.error || !res.data) return; // pas connecté, ou RDV introuvable/pas le sien (RLS) — on laisse le parcours normal
    var booking = res.data;
    reschedulingBooking = { id: booking.id, label: booking.label, prestation: booking.prestation, coiffeur: booking.coiffeur };
    renderRescheduleBanner();
    if (booking.coiffeur && COIFFEURS.indexOf(booking.coiffeur) !== -1) {
      selectedCoiffeur = booking.coiffeur;
      renderCoiffeurCards();
    }
    if (booking.prestation) {
      selectedPrestation = booking.prestation;
      renderPrestationCards();
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('footerYear').textContent = '© ' + new Date().getFullYear() + ' Salon Odette (exemple)';
});

document.getElementById('step2BackBtn').addEventListener('click', function () { goToStep(1); });
document.getElementById('step3BackBtn').addEventListener('click', function () { goToStep(2); });

var prevWeekBtn = document.getElementById('prevWeekBtn');
var nextWeekBtn = document.getElementById('nextWeekBtn');
if (prevWeekBtn) prevWeekBtn.addEventListener('click', function () { if (weekOffset > 0) { weekOffset--; buildCalendar(); } });
if (nextWeekBtn) nextWeekBtn.addEventListener('click', function () { if (weekOffset < MAX_WEEKS_AHEAD) { weekOffset++; buildCalendar(); } });

renderCoiffeurCards();
renderPrestationCards();
goToStep(1);
loadRescheduleFromUrl();
// Rendu initial garanti du panneau de compte, comme sur la v2 de l'accueil —
// évite qu'un déclenchement trop précoce de sb.auth.onAuthStateChange (avant
// que ce script ait fini de charger) ne laisse le panneau vide.
renderAllAccountPanels();
