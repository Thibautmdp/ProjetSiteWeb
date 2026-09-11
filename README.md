# Projet Max de Moula — Portable

Sites de démonstration (fictifs) utilisés comme exemples de réalisation à
montrer à des prospects. Aucun n'est un vrai site client.

| Dossier | Contenu | Backend |
|---|---|---|
| [`salon-odette/`](salon-odette/) | Salon de coiffure fictif — vitrine, réservation, compte client, espace coiffeur. **Version principale.** | Supabase (auth + base de données) |
| [`site-odette2/`](site-odette2/) | Même salon, variante avec un parcours de réservation guidé en 3 étapes (coiffeur → type de coupe → créneau) sur sa propre page, à comparer avec l'originale. Dossier autonome (copies propres du compte/connexion), sauf "Espace coiffeur" qui renvoie vers `salon-odette/` (un seul espace coiffeur existe). | Supabase (même projet) |
| [`vitrine-de-quartier/`](vitrine-de-quartier/) | Vitrine de commerce de quartier fictif | Aucun (page statique) |

## Démarrage rapide

Prérequis : **Git** et **Python 3.7+** (déjà installés sur la plupart des
machines ; rien d'autre à installer — voir [Dépendances](#dépendances)
ci-dessous).

```bash
git clone https://github.com/Thibautmdp/ProjetSiteWeb.git
cd ProjetSiteWeb
python main.py
```

`main.py` demande quel site lancer, démarre un serveur local (bibliothèque
standard de Python uniquement, rien à installer) et ouvre le navigateur
dessus. Pour sauter le menu :

```bash
python main.py salon-odette
python main.py site-odette2
python main.py vitrine-de-quartier
```

Arrêter le serveur : `Ctrl+C`.

### Sans Python

Chaque site est du HTML/CSS/JS statique : n'importe quel serveur de fichiers
statiques fonctionne (extension VS Code "Live Server", `npx serve`, etc.).
Ouvrir directement le `.html` en double-clic (`file://`) fonctionne aussi
pour `vitrine-de-quartier` ; pour `salon-odette`, un vrai serveur local est
préférable (évite les éventuelles restrictions de certains navigateurs sur
`file://` pour les requêtes réseau vers Supabase).

## Dépendances

**Il n'y a pas de gestionnaire de paquets dans ce dépôt** (pas de
`package.json`, pas de `requirements.txt`) : ces sites sont volontairement
sans étape de build.

La seule dépendance externe est **Supabase JS**, utilisée par `salon-odette`
et chargée directement depuis une CDN dans le HTML :

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/dist/umd/supabase.js"></script>
```

Ce choix est volontaire plutôt qu'un oubli : la copier en local
(« vendoring ») n'apporterait pas d'autonomie réelle, puisque `salon-odette`
appelle de toute façon l'API Supabase en ligne (authentification, base de
données) à chaque utilisation — sans connexion internet, le site ne
fonctionnerait pas non plus. Charger la lib depuis la CDN reste donc le plus
simple et le plus pratique : toujours à jour sur la version épinglée
(`@2.112.4`), sans fichier à maintenir dans le dépôt. Si un jour ce site
devait fonctionner hors-ligne ou sans dépendre d'une CDN tierce, la lib
pourrait être copiée dans `salon-odette/vendor/supabase-js.min.js` et le
`<script src>` pointé dessus — mais ça n'a d'intérêt que si l'appel réseau
vers l'API Supabase elle-même est aussi supprimé (donnée locale simulée), ce
qui changerait fondamentalement la démo.

`vitrine-de-quartier` n'a aucune dépendance JS — seule une feuille de police
Google Fonts est chargée en CSS.

## Backend Supabase (`salon-odette` uniquement)

L'URL et la clé publique du projet Supabase sont codées en dur dans
[`salon-odette-connexion.js`](salon-odette/salon-odette-connexion.js). C'est
volontaire et sans risque : c'est une clé *publishable* (anciennement
« anon key »), faite pour être exposée côté client — la vraie sécurité est
assurée par les règles Row Level Security définies dans
[`salon-odette-schema.sql`](salon-odette/salon-odette-schema.sql) (chaque
client ne peut lire/modifier que ses propres données).

Le projet Supabase existe déjà en ligne (org "ProjetMaxdeMoula", plan Free)
— une machine vierge n'a donc rien à recréer pour que le site fonctionne, du
moment qu'elle a accès à internet. `salon-odette-schema.sql` ne sert que si
le projet Supabase doit être reconstruit de zéro un jour : il est idempotent
(peut être rejoué sans erreur) et s'exécute dans le SQL Editor de Supabase.

## Problèmes connus

- **`main.py` : "le port 8000 est déjà utilisé"** — un serveur tourne déjà
  (peut-être lancé par un run précédent) : fermez-le, ou changez `PORT` en
  haut de `main.py`.
- Les pages HTML déclarent `<!DOCTYPE html>` et `<meta charset="UTF-8">` en
  tête de fichier : nécessaire pour que les accents s'affichent correctement
  (sans ça, certains navigateurs devinent le mauvais encodage). Ne pas les
  retirer en modifiant l'en-tête des fichiers.
