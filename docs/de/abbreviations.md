---
id: abbreviations
title: Abkürzungsverzeichnis
language: de
---

# Abkürzungsverzeichnis

Dieses Verzeichnis enthält die in maptoy und seiner Dokumentation verwendeten
Abkürzungen. Produkt- und Formatnamen, die keine Abkürzungen sind, werden im
[Glossar](docs/de/glossary) erklärt.

| Abkürzung | Langform | Bedeutung in maptoy |
| --- | --- | --- |
| ADR | Architecture Decision Record | Versionierte Aufzeichnung einer wichtigen Architekturentscheidung und ihrer Begründung. |
| API | Application Programming Interface | HTTP-Schnittstelle, die von der Webanwendung und anderen Clients verwendet wird. |
| CSP | Content Security Policy | Browser-Richtlinie, die zulässige Ressourcen und Ursprünge der Anwendung einschränkt. |
| CRS | Coordinate Reference System | Koordinatensystem zusammen mit den Angaben, die Koordinaten auf der Erde verorten. |
| DPI | Dots per inch | Metadatum zur Ausgabeauflösung eines exportierten Rasterbilds; es erzeugt allein keine zusätzlichen Kartendetails. |
| EPSG | European Petroleum Survey Group | Namensursprung der gebräuchlichen numerischen Kennungen für Koordinatenreferenzsysteme, etwa `EPSG:3857`. |
| EXIF | Exchangeable image file format | Metadaten in Bilddateien, die unter anderem Ausrichtung, Aufnahmezeit und GPS-Koordinaten enthalten können. |
| GDAL | Geospatial Data Abstraction Library | Kommandozeilenwerkzeuge, die maptoy zur Reprojektion von Rasterbildern verwendet. |
| GPS | Global Positioning System | Satellitengestütztes Positionierungssystem; maptoy kann GPS-Koordinaten aus Bildern und Tracks verwenden. |
| GPX | GPS Exchange Format | XML-Format zum Austausch von Tracks, Routen und Wegpunkten. |
| HTTP | Hypertext Transfer Protocol | Protokoll für die maptoy-API und, soweit zugelassen, für Provider-Anfragen. |
| HTTPS | Hypertext Transfer Protocol Secure | Durch Transportverschlüsselung geschütztes HTTP; Standardprotokoll für externe Provider. |
| JPEG | Joint Photographic Experts Group | Verlustbehaftetes Rasterbildformat, das für Kartenexporte unterstützt wird. |
| JSON | JavaScript Object Notation | Strukturiertes Datenformat der API, der Konfigurationsschemata und von GeoJSON. |
| OGC | Open Geospatial Consortium | Standardisierungsorganisation für Geodatenstandards wie WMTS. |
| PNG | Portable Network Graphics | Verlustfreies Rasterbildformat, das für Tiles und Kartenexporte unterstützt wird. |
| SDK | Software Development Kit | Versionierte Verträge zur Entwicklung von Renderer-Adaptern und Layer-Plugins. |
| SPA | Single-Page Application | Browseranwendung für die maptoy-Oberfläche und clientseitige Navigation. |
| SQL | Structured Query Language | Sprache für Abfragen an die SQLite-Metadatenbank. |
| SSRF | Server-Side Request Forgery | Angriffsklasse, bei der ein Server zu einer unbeabsichtigten Netzwerkanfrage veranlasst wird. |
| UI | User Interface | Browserbasierte Bedienoberfläche mit ihren Ansichten und Steuerelementen. |
| URL | Uniform Resource Locator | Adresse einer Anwendungsroute, Tile-Quelle oder externen Referenz. |
| WGS 84 | World Geodetic System 1984 | Geodätisches Referenzsystem für Eingaben aus Längen- und Breitengrad mit der Kennung `EPSG:4326`. |
| WMTS | Web Map Tile Service | OGC-Standard zur Bereitstellung von Kartenkacheln; WMTS-Sonderfälle gehören nicht zu maptoy v1.0. |
| XYZ | Kein Initialwort; `x`, `y` und `z` sind Tile-Koordinaten | In maptoy v1.0 verwendetes Tile-Schema: `z` bezeichnet die Zoomstufe, `x` und `y` identifizieren ein Tile. |
