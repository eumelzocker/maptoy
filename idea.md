Es soll für den privaten Gebrauch eine Docker-App names maptoy erstellt werden.

## Tech:
- Development auf NixOS-Platform mit flake und direnv
- englischsprachiges Projekt (codebase/frontend) mit deutschsprachigem KI-Assitenten
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
- Karten Bitmaperzeugung (nicht zwangsläufig bmp-Format) mit optinal anpassbarer Projektion und optionalen Zusatzlayern (zb GPS-Tracks, Images etc)