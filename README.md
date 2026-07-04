# Denoiz — Clean Signal, Safe Life

Plateforme frontend de monitoring ECG temps réel, conçue pour l'ingénierie biomédicale, la recherche et les applications futures d'intelligence artificielle appliquée au signal cardiaque.

## Vue d'ensemble

- Plateforme 100 % frontend (aucun backend, aucune API distante).
- Communication Bluetooth Low Energy réelle via l'API Web Bluetooth.
- Traitement du signal cardiaque en temps réel : filtrage, HRV, détection QRS, arythmies.
- Progressive Web App installable, responsive sur mobile, tablette et desktop.
- Thème sombre et thème clair, avec bascule persistante.
- Aucune donnée n'est envoyée à un serveur : tout reste sur l'appareil.

## Fonctionnalités

### Connectivité Bluetooth
- Trois modes de scan : Heart Rate standard, filtrage par UUID de service, acceptation universelle (DIY, ESP32, prototypes).
- Restauration automatique du dernier capteur au redémarrage.
- Reconnexion automatique avec backoff exponentiel (1s à 30s).
- Suivi de la perte de paquets, du jitter, du débit, de l'intervalle moyen.
- Lecture du niveau de batterie du capteur si exposé.
- Extraction des intervalles RR à partir de la trame Heart Rate standard.
- Support d'une caractéristique brute Float32 little-endian pour les capteurs personnalisés.
- Détection des navigateurs incompatibles (iOS Safari, Firefox) avec message d'orientation.
- Journal d'événements Bluetooth en direct.

### Monitoring temps réel
- Barre d'état globale persistante affichant état BLE, BPM, débit, mode démo, thème.
- Tableau de bord en grille bento : rythme cardiaque en grand format, métriques secondaires en tuiles compactes.
- Visualisation d'onde ECG haute performance sur canvas HTML5, 250 Hz.
- Superposition des pics R détectés par algorithme Pan-Tompkins simplifié.
- Historique du rythme cardiaque avec dégradé et lissage temporel.
- Indicateur de qualité de signal en pourcentage.
- Animation de battement synchronisée sur le BPM courant.

### Analyse HRV
- RMSSD : racine carrée de la moyenne des carrés des différences RR successives.
- SDNN : écart-type des intervalles RR.
- pNN50 : pourcentage d'intervalles RR successifs différant de plus de 50 ms.
- Fréquence cardiaque moyenne et intervalle RR moyen.
- Deux fenêtres de calcul : 2 minutes et 5 minutes.

### Détection d'arythmies
- Tachycardie (supérieur à 100 bpm, alerte au-delà de 130).
- Bradycardie (inférieur à 50 bpm, alerte en dessous de 40).
- Rythme irrégulier basé sur RMSSD anormalement élevé.
- Codage tricolore : normal, surveillance, alerte.

### Correction guidée du signal
- Assistant en trois étapes : suppression de la dérive de base, filtre coupe-bande secteur, lissage.
- Aperçu avant/après sur un échantillon glissant de six secondes.
- Filtres réglables : biquad notch, passe-haut du premier ordre, moyenne mobile.
- Application confirmée en direct sur le flux principal.

### Sessions et archives
- Enregistrement local des sessions dans IndexedDB.
- Chaque session conserve les trois pistes complètes (original, bruité, filtré).
- Pagination de l'archive au-delà de douze enregistrements.
- Suppression individuelle ou vidage complet.

### Relecture
- Lecteur avec lecture, pause, avance/retour d'une seconde.
- Vitesses de lecture : 0.5×, 1×, 2×, 4×.
- Zoom temporel jusqu'à 64×.
- Barre de scrubbing synchronisée avec les trois pistes.
- Raccourcis clavier : Espace (lecture/pause), flèches (±1s, Shift ±5s), plus et moins (zoom).
- Annotations horodatées ancrées à un instant précis de la session.

### Comparaison de sessions
- Sélection de deux enregistrements en parallèle.
- Visualisation côte à côte des pistes brutes et filtrées.
- Fenêtre temporelle commune synchronisée automatiquement.
- Métriques comparatives : durée, BPM moyen, qualité.

### Calibration
- Gain (mV par unité brute) et offset (mV) réglables.
- Application temps réel à chaque échantillon entrant.
- Formule affichée en direct.
- Persistance locale.

### Export
- CSV structuré : en-tête de métadonnées, colonnes index, temps, original, bruité, filtré.
- JSON structuré : bloc métadonnées, checksums FNV-1a par piste, canaux complets.
- Snapshot PNG haute résolution du tableau de bord avec pied de rapport signé Denoiz.
- Téléchargement direct côté navigateur.

### Mode démo
- Rejeu d'un enregistrement ECG intégré comme s'il s'agissait d'un flux BLE réel.
- Bascule depuis la barre d'état ou depuis l'état vide du moniteur.
- Détection R basique intégrée pour émettre des tics BPM authentiques.
- Chargement à la demande, sans impact sur les performances lorsqu'inactif.

### Notifications
- Permission demandée à l'utilisateur.
- Alerte système native en cas de déconnexion du capteur pendant un enregistrement.

### Progressive Web App
- Manifeste complet avec icônes any et maskable.
- Métadonnées Apple et Android pour l'installation.
- Barre de statut translucide sur iOS.
- Orientation portrait par défaut.
- Écran de démarrage adapté aux thèmes clair et sombre.

### Design system
- Typographie : Space Grotesk pour les titres, JetBrains Mono pour les nombres et les données.
- Palette OKLCH cohérente entre thème clair et thème sombre.
- Effets verre dépoli, halo primaire, transitions Framer Motion partagées entre les vues.
- Illustration SVG animée pour les états vides.
- Micro-interactions layoutId sur les transitions sessions vers relecture.
- Grille bento adaptative de deux à douze colonnes.

### Confidentialité et sécurité
- Aucune télémétrie, aucun tracker, aucune requête externe applicative.
- IndexedDB et localStorage strictement locaux.
- Aucune identification utilisateur.
- Aucun envoi de données de santé sur le réseau.

## Compatibilité

- Chrome, Edge et Opera sur Desktop et Android : compatibilité complète.
- Safari sur iOS, iPadOS et macOS : Web Bluetooth non supporté par le navigateur. Alternative : navigateur Bluefy sur iOS.
- Firefox : Web Bluetooth désactivé par défaut, utiliser un navigateur Chromium.
- HTTPS ou localhost obligatoires pour l'accès Bluetooth.

## Matériel supporté

- Capteurs conformes au profil Bluetooth Heart Rate (Polar H10, H9, Wahoo TICKR, Garmin HRM).
- Modules DIY basés sur ESP32, nRF52 ou équivalent exposant une caractéristique Float32.
- Tout périphérique BLE en mode Accept All pour test et développement.

## Structure des données de session

Chaque session enregistrée contient :

- Identifiant unique.
- Horodatage de démarrage et durée.
- Fréquence d'échantillonnage.
- BPM moyen et indice de qualité.
- Trois buffers Float32Array (original, bruité, filtré).
- Nom de l'appareil source ou mention du mode démo.

## Architecture technique

- Vite, React 19, TanStack Router en routage typé.
- Tailwind CSS v4 avec design tokens OKLCH.
- Framer Motion pour animations et transitions partagées.
- Aucune dépendance backend, aucun serveur.

## Licence

Projet à usage personnel et éducatif. Pas d'usage clinique sans validation réglementaire.
