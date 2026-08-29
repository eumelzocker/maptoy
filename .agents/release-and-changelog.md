# Release- und Changelog-Praxis

- Maßgeblich sind der Release-Abschnitt in `plan.md` und die tatsächlich unter
  `CHANGELOG.md` dokumentierten Inhalte; vorab angenommene Versionsnummern sind
  keine Zusage.
- Jeder zusammenhängende, vollständig geprüfte Entwicklungsstand darf eine
  Patchversion werden. Eine Phase kann mehrere Releases umfassen, und ein Release
  muss keine komplette Phase abschließen. `1.0.0` bleibt Phase 9 und der gesamten
  Definition of Done vorbehalten.
- Alle auslieferungsrelevanten maptoy-Pakete verwenden dieselbe App-Version und
  werden gemeinsam versioniert. Die Firefox-Erweiterung besitzt einen unabhängigen
  Versionszyklus; ihr Paket- und Browsermanifest bleiben untereinander synchron und
  ändern sich nur bei Erweiterungsänderungen.
- Änderungen während der Entwicklung sofort knapp und ergebnisorientiert unter
  `## [Unreleased]` in `Added`, `Changed`, `Fixed`, `Removed` oder einer bei Bedarf
  passenden weiteren Keep-a-Changelog-Kategorie eintragen. Nutzerrelevantes
  Verhalten, APIs, Persistenz, Betrieb und Dokumentation gehören hinein; reine
  Implementierungsdetails normalerweise nicht.
- Vor einem Release die angesammelten Einträge zusammenführen, Dopplungen entfernen
  und gegen den tatsächlichen Diff prüfen. Historische Release-Abschnitte nicht
  nachträglich umdeuten. Für das Release `Unreleased` als `## [x.y.z] - YYYY-MM-DD`
  abschließen und darüber einen neuen leeren `## [Unreleased]`-Abschnitt anlegen.
- Vor Versionierung und Release-Commit mindestens die Qualitäts-Gates aus `plan.md`
  erfüllen: Formatierung, Linting, Typprüfung, Tests und Build. Je nach Änderung
  zusätzlich Contract-, Integrations-, E2E-, Dokumentations- und Container-Smokes
  ausführen. Bekannte Warnungen ausdrücklich nennen, aber nicht als bestandene
  Prüfung verschweigen.
- Release-Artefakte, Tag und Commit erst erzeugen, wenn Versionen, Datum, Changelog,
  Tests und Build konsistent sind. Die konkrete Versionswahl und Veröffentlichung
  bleiben eine ausdrückliche Release-Aufgabe und werden nicht nebenbei aus normalen
  Implementierungsänderungen abgeleitet.
