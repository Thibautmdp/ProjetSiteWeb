/*
  ============================================================================
  SALON ODETTE — CONNEXION (compte Supabase : inscription, connexion, session)
  ============================================================================

  OBJECTIFS DE CE FICHIER
  - Créer le client Supabase (URL + clé publique) utilisé par tout le site.
  - Savoir à tout moment si un visiteur est connecté (currentSession), et gérer
    l'inscription (email + mot de passe) et la connexion.
  - Afficher le formulaire de création de compte / connexion tant que personne
    n'est connecté, et un petit formulaire de secours "Complétez votre profil"
    si la session existe mais qu'aucune ligne profils n'a été trouvée (ex.
    inscription interrompue par la confirmation email).
  - Décider, à chaque rendu, QUEL écran de compte afficher (dispatcher) — la
    vue "je gère mon compte une fois pleinement connecté" est déléguée à
    salon-odette-client.js.

  CE QUI A ÉTÉ FAIT (2026-08-31 / 2026-09-02)
  - Vraie authentification Supabase (email + mot de passe), à la place de
    l'ancien système de "profil" en localStorage (pas un vrai compte sécurisé).
  - Prénom/téléphone envoyés en métadonnées à l'inscription (pas via un insert
    séparé après coup) + un trigger côté base (voir salon-odette-schema.sql)
    qui les copie dans `profiles` dès la création du compte auth.users — ça
    fonctionne même si "Confirm email" est activé côté Supabase, puisque ça ne
    dépend pas d'avoir déjà une session active.
  - Messages d'erreur de connexion clarifiés (email non confirmé, identifiants
    invalides) plutôt que le message brut de Supabase.
  - Écran de secours "Complétez votre profil" quand la ligne profils manque.

  CE QU'IL RESTE À FAIRE
  - Modifier l'email de connexion lui-même (aujourd'hui non modifiable — seul
    un email de CONTACT dans le profil peut être changé, voir salon-odette-client.js
    — changer le vrai email de connexion demanderait le flux de reconfirmation
    de Supabase, volontairement laissé de côté pour l'instant).
  - Mot de passe oublié / réinitialisation de mot de passe.
  - Trancher si "Confirm email" doit rester activé ou non pour un vrai client
    (ça marche dans les deux cas aujourd'hui, mais rien n'a encore été décidé).

  FONCTIONS DE CE FICHIER
  - renderAccountInto(panel, prefix)
      Point d'entrée appelé pour (re)dessiner un panneau de compte. Regarde
      l'état de la session/du profil et choisit quoi montrer : le formulaire
      de connexion/inscription, l'écran "Complétez votre profil", ou délègue
      à renderClientAccount() pour la suite (profil complet + rendez-vous).

  DÉPEND DE (fonctions/variables définies dans d'autres fichiers — tous les
  fichiers du site partagent un seul espace global, volontairement : aucun
  n'est isolé dans sa propre IIFE, pour qu'ils puissent s'appeler entre eux
  comme des scripts classiques) :
  - renderClientAccount(panel, ids, isModalPanel, prefix) → salon-odette-client.js
  - refreshAndRenderAll(), editingProfile                 → salon-odette-client.js
  - selectedSlot, completePendingBooking()                → salon-odette-reservation.js
    (pour finaliser automatiquement une réservation en attente juste après une
    inscription/connexion réussie depuis la fenêtre de réservation)

  FOURNIT AUX AUTRES FICHIERS
  - sb              : client Supabase, créé ici, utilisé par tous les fichiers.
  - currentSession  : session active (objet Supabase), ou null si déconnecté.
  - renderAccountInto(panel, prefix)
  ============================================================================
*/

var SUPABASE_URL = 'https://vyqbbqeskzyromoyxrff.supabase.co';
var SUPABASE_KEY = 'sb_publishable_zR0jfkgIXbfDrLPLxurx7w_QJIDW1t6';
// persistSession: false — pendant qu'on teste plusieurs comptes, le site ne doit PAS se
// souvenir de la connexion d'une ouverture à l'autre (sinon on rouvre la page et on
// retombe sur le dernier compte utilisé, ce qui prête à confusion en plein test). À
// REMETTRE à true (ou supprimer cette option, true est la valeur par défaut) le jour où
// le site sera montré à de vrais clients — eux voudront rester connectés d'une visite à
// l'autre, comme sur n'importe quel site.
var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

var currentSession = null;

function renderAccountInto(panel, prefix) {
  if (!panel) return;
  var isModalPanel = panel.id === 'accountPanel';
  var ids = {
    prenom: prefix + '-prenom', tel: prefix + '-tel', email: prefix + '-email', pass: prefix + '-pass',
    createBtn: prefix + '-createBtn', loginBtn: prefix + '-loginBtn', editBtn: prefix + '-editBtn',
    loginStatus: prefix + '-loginStatus', forgetBtn: prefix + '-forgetBtn', confirmBtn: prefix + '-confirmBtn'
  };

  if (!currentSession) {
    panel.innerHTML =
      '<h3>Votre compte client</h3>' +
      '<p class="account-sub">Créez votre compte une fois, retrouvez-le ensuite sur tous vos appareils.</p>' +
      '<div class="field"><label for="' + ids.prenom + '">Prénom</label><input type="text" id="' + ids.prenom + '" autocomplete="given-name"></div>' +
      '<div class="field"><label for="' + ids.tel + '">Téléphone</label><input type="tel" id="' + ids.tel + '" autocomplete="tel"></div>' +
      '<div class="field"><label for="' + ids.email + '">Email</label><input type="email" id="' + ids.email + '" autocomplete="email"></div>' +
      '<div class="field"><label for="' + ids.pass + '">Mot de passe</label><input type="password" id="' + ids.pass + '" autocomplete="new-password"></div>' +
      '<div class="form-actions">' +
        '<button type="button" id="' + ids.createBtn + '" class="btn btn-primary">Créer mon compte</button>' +
        '<button type="button" id="' + ids.loginBtn + '" class="btn btn-ghost">Se connecter</button>' +
      '</div>' +
      '<p class="account-sub" style="margin-top:10px; margin-bottom:0;">Déjà client&nbsp;? Renseignez email + mot de passe puis "Se connecter" (prénom/téléphone ne sont utiles qu\'à la création).</p>' +
      '<p id="' + ids.loginStatus + '" class="login-alert" hidden></p>';

    panel.querySelector('#' + ids.createBtn).addEventListener('click', function () {
      var prenom = panel.querySelector('#' + ids.prenom).value.trim();
      var tel = panel.querySelector('#' + ids.tel).value.trim();
      var email = panel.querySelector('#' + ids.email).value.trim();
      var pass = panel.querySelector('#' + ids.pass).value;
      var loginStatus = panel.querySelector('#' + ids.loginStatus);
      if (!prenom || !tel || !email || !pass) {
        loginStatus.textContent = 'Merci de remplir prénom, téléphone, email et mot de passe.';
        loginStatus.hidden = false;
        return;
      }
      if (pass.length < 6) {
        loginStatus.textContent = 'Le mot de passe doit faire au moins 6 caractères.';
        loginStatus.hidden = false;
        return;
      }
      loginStatus.hidden = true;
      // prenom/telephone partent en métadonnées du compte : enregistrés immédiatement à
      // l'inscription (sans avoir besoin d'une session), un trigger côté base les copie
      // ensuite dans profiles dès la création du compte — voir salon-odette-schema.sql
      sb.auth.signUp({
        email: email,
        password: pass,
        options: { data: { prenom: prenom, telephone: tel } }
      }).then(function (res) {
        if (res.error) {
          loginStatus.textContent = res.error.message;
          loginStatus.hidden = false;
          return;
        }
        if (!res.data.session) {
          loginStatus.textContent = 'Compte créé — vérifiez votre email pour confirmer votre inscription, puis connectez-vous.';
          loginStatus.hidden = false;
          return;
        }
        currentSession = res.data.session;
        refreshAndRenderAll().then(function () {
          if (isModalPanel && selectedSlot) completePendingBooking();
        });
      });
    });

    panel.querySelector('#' + ids.loginBtn).addEventListener('click', function () {
      var email = panel.querySelector('#' + ids.email).value.trim();
      var pass = panel.querySelector('#' + ids.pass).value;
      var loginStatus = panel.querySelector('#' + ids.loginStatus);
      if (!email || !pass) {
        loginStatus.textContent = 'Entrez votre email et votre mot de passe pour vous connecter.';
        loginStatus.hidden = false;
        return;
      }
      loginStatus.hidden = true;
      sb.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
        if (res.error) {
          var msg = res.error.message || '';
          if (msg.indexOf('Email not confirmed') !== -1) {
            loginStatus.textContent = 'Votre email n\'est pas encore confirmé — vérifiez votre boîte de réception, ou désactivez "Confirm email" dans Supabase (Authentication → Providers → Email) pour les tests.';
          } else if (msg.indexOf('Invalid login credentials') !== -1) {
            loginStatus.textContent = 'Email ou mot de passe incorrect.';
          } else {
            loginStatus.textContent = msg || 'Erreur de connexion.';
          }
          loginStatus.hidden = false;
          return;
        }
        currentSession = res.data.session;
        refreshAndRenderAll().then(function () {
          if (isModalPanel && selectedSlot) completePendingBooking();
        });
      });
    });
    return;
  }

  if (!currentProfile) {
    // Session active mais aucune ligne dans profiles (ex. inscription interrompue,
    // ou confirmation email en attente au moment de la création du compte).
    panel.innerHTML =
      '<h3>Complétez votre profil</h3>' +
      '<p class="account-sub">Connecté en tant que ' + currentSession.user.email + ' — il ne manque plus que votre prénom et téléphone.</p>' +
      '<div class="field"><label for="' + ids.prenom + '">Prénom</label><input type="text" id="' + ids.prenom + '" autocomplete="given-name"></div>' +
      '<div class="field"><label for="' + ids.tel + '">Téléphone</label><input type="tel" id="' + ids.tel + '" autocomplete="tel"></div>' +
      '<div class="form-actions"><button type="button" id="' + ids.createBtn + '" class="btn btn-primary">Enregistrer mon profil</button></div>' +
      '<p id="' + ids.loginStatus + '" class="login-alert" hidden></p>' +
      '<button type="button" class="account-forget" id="' + ids.forgetBtn + '">Se déconnecter</button>';

    panel.querySelector('#' + ids.createBtn).addEventListener('click', function () {
      var prenom = panel.querySelector('#' + ids.prenom).value.trim();
      var tel = panel.querySelector('#' + ids.tel).value.trim();
      var loginStatus = panel.querySelector('#' + ids.loginStatus);
      if (!prenom || !tel) {
        loginStatus.textContent = 'Merci de remplir prénom et téléphone.';
        loginStatus.hidden = false;
        return;
      }
      sb.from('profiles').insert({ id: currentSession.user.id, prenom: prenom, telephone: tel, email: currentSession.user.email }).then(function (res) {
        if (res.error) {
          loginStatus.textContent = 'Erreur : ' + res.error.message;
          loginStatus.hidden = false;
          return;
        }
        refreshAndRenderAll();
      });
    });
    panel.querySelector('#' + ids.forgetBtn).addEventListener('click', function () {
      sb.auth.signOut();
    });
    return;
  }

  renderClientAccount(panel, ids, isModalPanel, prefix);
}

sb.auth.onAuthStateChange(function (_event, session) {
  currentSession = session;
  if (!session) { editingProfile.m = false; editingProfile.s = false; }
  refreshAndRenderAll();
});
