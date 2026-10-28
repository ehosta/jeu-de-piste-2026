# Campudex (nom ouvert aux propositions)

Le but du jeu de piste de cette année est de prendre des photos des photos de divers endroits du campus, en se basant sur les descriptions données par un donneur de quête, et de remplir leur "album".

## Lore principal

Le monde de Faurtitou subit un terrible maléfice. Les individus présents depuis trop longtemps ont été ancrés dans un petit chunk, et ne peuvent désormais aller qu'aux endroits présents dans le Campudex. Problème ? Ils l'ont filé à Sir Claudius, qui n'était encore qu'apprenti et qui a commis des erreurs irréparables, détruisant toutes les images du Campudex (certains diront avoir entendu le sort "Hérème Hérèfe et Toiles Tirétiré Noprézairve Route !").

Il incombe alors aux Sangs Nouveaux de reconstituer le Campudex afin de permettre à ces âmes condamnées de regagner leur mobilité.

## Rôle de donneur de quêtes

Placement libre dans le campus, avec un lore customisé (au choix pour chaque bénévole). Les joueurs devront leur parler, et les donneurs de quêtes devront leur poser une problématique où la réponse se trouve à l'endroit où la photo doit être prise.

> Exemple : un donneur de quête se trouve en AFK, et demande à des joueurs "J'ai faim, ça fait des années que je n'ai pas pu manger autre chose que les cailloux sur le sol. Je cherche un endroit spacieux où les plats sont cuisinés avec passion pour seulement 8 euros le menu (sponso campus (la région approuve (Auvergne-Rhône-Alpes)))."
> Et les joueur doivent alors prendre en photo la cantine.

Les joueurs doivent alors revenir avec la réponse ainsi que la photo, et si le donneur de quête juge la photo correcte, alors il donne un "flag" permettant de valider définitivement (verrouiller) la photo et de valider la quête.
Le lieu à prendre en photo peut être clair comme l'exemple, ou dit de manière plus énigmatique (en matching avec son lore et à la guise du donneur de quêtes).
PS : les donneurs de quête peuvent évidemment inventer leur propre lore (vous êtes libres de proposer/repenser votre façon d'interagir etc).

# Fonctionnement technique

## Formation des groupes

Groupes aléatoires de 3 basés sur les données de l'intra. Chaque groupe possède un QR Code unique. Un nom de groupe marrant est généré aléatoirement.

## Interactions avec les PNJ

Les groupes devront trouver les PNJ. En s'approchant d'un PNJ, le groupe devra tendre le QR Code, et le faire scanner par le PNJ. Le PNJ lui pourra scanner le QR Code, et pourra dans un premier temps donner la quête. Puis au retour du groupe (après avoir pris leur photo), le PNJ scanne de nouveau le code du groupe et peut valider ou non.
Dès que la quête est validée, la photo est verrouillée et ne peut pas être reprise.

Les PNJ ne sont pas indiqués et les joueurs ont un temps imparti pour les trouver et réaliser leurs quêtes.

# Interfaces

Trois interfaces. Les personnes se connectent via leur Intra 42 pour avoir accès à leur page.

## Interface admin

Permet de tracker l'état du jeu, d'avancement des groupes, de voir les possibles erreurs, etc.

## Interface joueur

La même page pour tout le groupe, avec l'état des quêtes lancées, et terminées. Pour chaque quête, un petit bouton "+"
permettant de prendre une photo. Dès lors que la photo est validée par le PNJ, le bouton + disparait.

Un bouton permettant d'afficher le QR Code du groupe.

## Interface PNJ

Les PNJ ont un bouton pour scanner le QR Code, avec la validation associée (donner la quête/valider la quête).
