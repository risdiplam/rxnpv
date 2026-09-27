// ════════════════════════════════════════════════════════════════════════════
// Tools → Science workbench
// Target Dossier, Literature.
// Split out of toolsView.js (September 2026); shared helpers (toolCard,
// toolLabel, CasePicker, truncateText) live there.
// ════════════════════════════════════════════════════════════════════════════

// ── Target Dossier: is this target real? ───────────────────────────────────
// Deliberately NOT wired into the valuation. Open Targets' association score
// is a weighted aggregate over very heterogeneous evidence, and turning it
// into a PoS input would be precisely the kind of false precision this
// project avoids. What it answers is a conviction question the rest of the
// app can't: does human genetics point at this target, and what has already
// been tried against it.
function TargetDossierTool() {
  const h = React.createElement;
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [candidates, setCandidates] = React.useState(null);
  const [dossier, setDossier] = React.useState(null);
  const [error, setError] = React.useState(null);
  const seq = React.useRef(0);

  const search = async () => {
    if (!query.trim()) return;
    const mine = ++seq.current;
    setLoading(true); setError(null); setCandidates(null); setDossier(null);
    const r = await resolveTarget(query);
    if (mine !== seq.current) return;
    if (!r.ok) { setError(r.error); setLoading(false); return; }
    if (r.hits.length === 1) { await load(r.hits[0].ensemblId, mine); return; }
    setCandidates(r.hits); setLoading(false);
  };

  const load = async (ensemblId, mine) => {
    const token = mine || ++seq.current;
    setLoading(true); setError(null); setCandidates(null);
    const r = await fetchTargetDossier(ensemblId);
    if (token !== seq.current) return;
    if (!r.ok) { setError(r.error); setLoading(false); return; }
    setDossier(r.dossier); setLoading(false);
  };

  // Prefer the stage string the API actually returned over a re-derived one.
  const phaseLabel = (d) => d.stageLabel || (d.maxPhase >= 4 ? "Approved" : d.maxPhase > 0 ? "Phase " + d.maxPhase : "Preclinical/unknown");

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Target dossier"),
      h(Note, { summary: "New here? Why the target matters before the trial does" },
        h("div", { style: { lineHeight: 1.6 } }, "Before asking whether a trial is well designed, it's worth asking whether the biology it rests on is real. The most durable public signal for that is human genetics: if variants in a gene change a person's risk of the disease, a drug aimed at that gene is working with nature rather than against it. Targets with that kind of support have historically been about twice as likely to survive clinical development (Nelson et al., Nature Genetics 2015, replicated since). This pulls what Open Targets knows — which diseases the target is associated with, whether the association has direct human genetic evidence behind it or rests on animal models and pathway inference, and what drugs have already been tried against it and how far they got. It is context, not a score to plug into a model: no number from this page feeds the valuation, deliberately.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 } },
        h("input", { type: "text", value: query, placeholder: "Gene symbol — e.g. TTR, EGFR, SOD1, PCSK9",
          "aria-label": "Gene symbol or target name",
          onChange: e => setQuery(e.target.value), onKeyDown: e => { if (e.key === "Enter") search(); },
          style: { flex: "1 1 240px", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: search, disabled: loading || !query.trim(),
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: query.trim() ? 1 : 0.5 } },
          loading ? "Looking up…" : "Look up target")
      )
    ]),

    error && toolCard(h, h("div", { style: UI.warnNote }, error)),

    candidates && toolCard(h, [
      toolLabel(h, "Which target did you mean?"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
        candidates.map(c => h("button", { key: c.ensemblId, onClick: () => load(c.ensemblId),
          style: { textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--surface)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-1)" } },
          h("b", null, c.symbol), " · ", h("span", { style: { color: "var(--ink-3)" } }, c.ensemblId),
          c.description && h("div", { style: { fontFamily: "var(--sans)", fontSize: 10.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 } }, truncatedSpan(h, c.description, 160)))))
    ]),

    dossier && h("div", null,
      toolCard(h, [
        h("div", { style: { fontSize: 16, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)" } }, dossier.symbol),
        h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 2, marginBottom: 10 } }, dossier.name),
        h("div", { style: { display: "flex", gap: 22, flexWrap: "wrap" } },
          h("div", null,
            h("div", { style: UI.caption }, "Human genetic evidence"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 800, color: dossier.anyGeneticEvidence ? "var(--teal)" : "var(--ink-2)" } },
              dossier.anyGeneticEvidence ? "Present" : "None found")),
          h("div", null,
            h("div", { style: UI.caption }, "Associated diseases"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, dossier.diseaseCount.toLocaleString())),
          h("div", null,
            h("div", { style: UI.caption }, "Drugs against it"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, dossier.drugCount.toLocaleString())),
          h("div", null,
            h("div", { style: UI.caption }, "Reached Phase 3+"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, dossier.approvedOrLateStage))
        ),
        h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 12, lineHeight: 1.6 } },
          dossier.anyGeneticEvidence
            ? "At least one disease association here carries direct human genetic evidence. That is the supportive case — but check below whether the genetics point at YOUR indication specifically, not merely at some disease involving this gene."
            : "No direct human genetic evidence appears among the top associations. That is not evidence the target is wrong — plenty of approved drugs hit targets with no genetic signal — but it does mean the biological case rests on models and pathway reasoning rather than on human variation."),
        h("div", { style: { marginTop: 10 } },
          h(ExternalLink, { href: "https://platform.opentargets.org/target/" + dossier.ensemblId, style: { fontSize: 10 } }, "→ Full target profile on Open Targets"))
      ]),

      dossier.diseases.length > 0 && toolCard(h, [
        toolLabel(h, "Top disease associations"),
        h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginBottom: 10, lineHeight: 1.6 } },
          "“Genetic” means direct human genetic evidence for this specific target–disease link. A high overall score with no genetic component is built from other evidence types — animal models, pathway inference, expression, text mining — which are weaker grounds for believing the target causes the disease in people."),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
          dossier.diseases.map((d, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--rule)", fontSize: 11, fontFamily: "var(--mono)" } },
            h("span", { style: { color: "var(--ink-1)", flex: "1 1 auto" } }, d.name),
            h("span", { style: { color: d.hasGeneticEvidence ? "var(--teal)" : "var(--ink-3)", fontSize: 10, whiteSpace: "nowrap" } },
              d.hasGeneticEvidence ? "genetic " + d.geneticScore.toFixed(2) : "no genetic"),
            h("span", { style: { color: "var(--ink-2)", minWidth: 42, textAlign: "right" } }, d.overallScore.toFixed(2)))))
      ]),

      dossier.drugs.length > 0 && toolCard(h, [
        toolLabel(h, "Drugs already aimed at this target (" + dossier.drugs.length + " shown)"),
        h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginBottom: 10, lineHeight: 1.6 } },
          "What has been tried and how far it got. A target with approved drugs is validated but crowded; one where several programs stalled in Phase 2 is a different kind of warning than one nobody has attempted."),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 340, overflowY: "auto" } },
          dossier.drugs.map((d, i) => h("div", { key: i, style: { padding: "6px 0", borderBottom: "1px solid var(--rule)" } },
            h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, fontFamily: "var(--mono)" } },
              h("span", { style: { color: "var(--ink-1)" } }, d.name),
              h("span", { style: { color: d.maxPhase >= 4 ? "var(--teal)" : "var(--ink-2)", whiteSpace: "nowrap" } }, phaseLabel(d))),
            d.mechanism && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 2 } }, d.mechanism),
            d.indications.length > 0 && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 2 } },
              truncatedSpan(h, d.indications.slice(0, 4).join(", ") + (d.indications.length > 4 ? " +" + (d.indications.length - 4) + " more" : ""), 150)))))
      ])
    )
  );
}

// ── Literature shelf ───────────────────────────────────────────────────────
// Shared between the standalone search tab and the Trial Decoder's own
// "papers about this trial" panel. Engine in literatureEngine.js.
//
// The composition bar above the list is the point of the whole thing: twelve
// papers that turn out to be eleven reviews of one trial is a different
// evidence base from twelve trial reports, and a plain list of titles hides
// that completely.
const LIT_EVIDENCE_META = {
  primary:      { one: "primary paper",      many: "primary papers",      color: "var(--teal)",  note: "new evidence — a trial reporting its own result" },
  synthesis:    { one: "synthesis",          many: "syntheses",           color: "var(--ink-1)", note: "pools other people's trials" },
  secondary:    { one: "review",             many: "reviews",             color: "var(--ink-2)", note: "discusses evidence it did not generate" },
  unreviewed:   { one: "preprint",           many: "preprints",           color: "var(--warn)", note: "posted without peer review" },
  abstract:     { one: "conference abstract", many: "conference abstracts", color: "var(--warn)", note: "a few hundred words, no methods section" },
  anecdote:     { one: "case report",        many: "case reports",        color: "var(--ink-3)", note: "one patient, no control" },
  opinion:      { one: "opinion piece",      many: "opinion pieces",      color: "var(--ink-3)", note: "editorial or correspondence" },
  unclassified: { one: "paper of unstated type", many: "papers of unstated type", color: "var(--ink-3)", note: "indexed, but with no publication type saying what kind of study it is" }
};

function LiteratureList({ result, emptyText }) {
  const h = React.createElement;
  if (!result) return null;
  const rows = result.rows || [];
  const counts = result.counts || { byEvidence: {}, freeFullText: 0, total: 0 };
  const order = ["primary", "synthesis", "secondary", "unreviewed", "abstract", "anecdote", "opinion", "unclassified"];
  const present = order.filter(k => (counts.byEvidence[k] || 0) > 0);

  if (!rows.length) {
    return h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6 } },
      emptyText || "Nothing indexed matches that. A thin literature is itself informative for an early asset — but check the spelling of the target or drug name before reading it that way.");
  }

  return h("div", null,
    h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 8 } },
      h("div", null, "Showing " + rows.length + " of " + result.totalMatched.toLocaleString() + " indexed"
        + (counts.freeFullText ? " · " + counts.freeFullText + " readable without a subscription" : "")),
      h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3 } },
        present.map(k => {
          const n = counts.byEvidence[k], m = LIT_EVIDENCE_META[k];
          return h("span", { key: k, title: m.note, style: { color: m.color, cursor: "help" } }, n + " " + (n === 1 ? m.one : m.many));
        }))),

    h("div", { style: { display: "flex", flexDirection: "column", gap: 2, maxHeight: 520, overflowY: "auto" } },
      rows.map((r, i) => {
        const meta = LIT_EVIDENCE_META[r.evidence] || LIT_EVIDENCE_META.unclassified;
        return h("div", { key: r.id || i, style: { padding: "8px 0 8px 10px", borderLeft: "3px solid " + meta.color, borderBottom: "1px solid var(--rule)" } },
          h("div", { style: { display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", marginBottom: 2 } },
            h("span", { style: { fontSize: 10, fontFamily: "var(--mono)", color: meta.color, fontWeight: 700, } }, r.kindLabel),
            r.freeFullText && h("span", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--teal)" } }, "free full text"),
            r.citedBy != null && h("span", { style: UI.caption }, r.citedBy.toLocaleString() + " citations")),
          h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.5 } }, r.title),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 2 } },
            [r.venue, r.year].filter(Boolean).join(" · ")
              + (r.authors ? " · " + truncateText(r.authors, 60) : "")),
          h(ExternalLink, { href: r.url, style: { fontSize: 10, marginTop: 3, display: "inline-block" } }, "→ Read it"));
      })),

    h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 10 } },
      "Types come from MEDLINE's own publication tags, not from anything guessed here. Citation counts are an age-biased popularity measure — a 2018 paper has had seven years to accumulate them and a 2026 one has not — so they are useful for finding the paper everyone cites and useless as a quality score. Preprints have not been peer reviewed, whatever they report.")
  );
}

function LiteratureTool({ initialQuery }) {
  const h = React.createElement;
  const [q, setQ] = React.useState(initialQuery || "");
  // Most-cited by default, and deliberately so: relevance ranking on a
  // drug+indication query returns this month's editorials, while the pivotal
  // trial everyone is arguing about sits on page three. Verified on
  // sotatercept — most-cited puts STELLAR (Phase 3) and PULSAR (Phase 2) at
  // the top; best-match puts four 2026 letters and editorials there.
  const [sort, setSort] = React.useState("cited");
  const [excludePreprints, setExcludePreprints] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);
  const seq = React.useRef(0);

  const run = async () => {
    if (!q.trim()) return;
    const mine = ++seq.current;
    setLoading(true); setError(null); setResult(null);
    const r = await searchLiterature(q, { sort, excludePreprints, pageSize: 25 });
    if (mine !== seq.current) return;      // superseded by a newer search
    if (!r.ok) setError(r.error); else setResult(r);
    setLoading(false);
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Search the literature"),
      h(Note, { summary: "What this is, and what the name gets wrong" },
        h("div", { style: { lineHeight: 1.6 } },
          "This searches Europe PMC, and the name misleads: it is not a European database. Its main index is MEDLINE — the same records PubMed searches, in full — plus open-access full text, plus preprints from bioRxiv, medRxiv and Research Square. So this is a superset of PubMed rather than a regional slice of it, which is why there is one literature source here and not three; a second general index would return the same MEDLINE records again under a different name. ",
          "What it adds over a plain web search is the one thing a search engine cannot tell you: what kind of paper each result is. A primary randomized trial report, a meta-analysis, a narrative review and an unreviewed preprint arrive already separated, because the difference between “three trials support this” and “three reviews of the same trial support this” is most of what you are trying to establish.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" } },
        h("input", { type: "text", value: q, placeholder: "drug, target, indication, or an NCT number",
          "aria-label": "Literature search",
          onChange: e => setQ(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
          style: { flex: "1 1 280px", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("select", { value: sort, onChange: e => setSort(e.target.value), "aria-label": "Sort order",
          style: { padding: "9px 10px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          h("option", { value: "cited" }, "Most cited"),
          h("option", { value: "recent" }, "Most recent"),
          h("option", { value: "relevance" }, "Best match")),
        h("button", { onClick: run, disabled: loading || !q.trim(),
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: q.trim() ? 1 : 0.5 } },
          loading ? "Searching…" : "Search")),
      h("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", cursor: "pointer", marginTop: 8 } },
        h("input", { type: "checkbox", checked: excludePreprints, onChange: e => setExcludePreprints(e.target.checked) }),
        "Peer-reviewed only (exclude preprints)")
    ]),
    error && toolCard(h, h("div", { style: UI.warnNote },
      error + " This is a connection problem, not a finding that no papers exist.")),
    result && toolCard(h, [toolLabel(h, "Results for “" + result.query + "”"), h(LiteratureList, { result })])
  );
}
