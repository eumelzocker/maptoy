Es soll für den privaten Gebrauch eine Docker-App names maptoy erstellt werden.

## Tech:
- Development auf NixOS-Platform mit flake und direnv
- englischsprachiges Projekt (codebase/frontend) mit deutschsprachigem KI-Assitenten für Entwicklung
- Node/ts
- Biome for linting/formating
- Monorepo mit
  - Backend für tile-cache mit entsprechender API
  - Frontend Vue3 und leaflet
  - Backend/Frontend auf gleichem HTTP-Port
  - Basiskonfig (API-Keys, Ports, Verzeichnisse etc) über Environment (.env)

## Features:
- nur relative URLs/Pfade, keine Probleme hinter Reverse-Proxy
- Frei konfigurierbare Map-Sets
- Tile-Cache mit Versionierung
- Batch-Downloads (im Rachmen der Nutzungsbedingungen)
- Übersichtskarten für Cache-Abdeckung
- Zusatzlayer möglich zb für GPS-Tracks, GPS-tagged Images und Weiteres
- Karten Bitmaperzeugung (nicht zwangsläufig bmp-Format) mit optinal anpassbarer Projektion und optionalen Zusatzlayern.
- integrierte Dokumentation für App, API, Map-Provider, Projektionen, Abkürzungen und sonstiges in deutsch, thai, (optinal weitere) und englisch, ggf. mit Links zu externen docs. engl. als Fallback für fehlende Lokalisierungen.
- Spätere, einfache Erweiterbarkeit um [Google Maps JavaScript API v3 Reference](https://developers.google.com/maps/documentation/javascript/reference/) und ggf. weitere APIs
