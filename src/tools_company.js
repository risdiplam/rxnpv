// ════════════════════════════════════════════════════════════════════════════
// Tools → Company workbench
// Company Lookup, Catalyst Calendar, Cash Runway, Runway vs. Catalyst.
// Split out of toolsView.js (September 2026); shared helpers (toolCard,
// toolLabel, CasePicker, truncateText) live there.
// ════════════════════════════════════════════════════════════════════════════

// ── Company Lookup: EDGAR financials + CT.gov pipeline, combined ──
function CompanyLookupTool({ cases, updateCase, activeCase, onWatchTrial }) {
  const h = React.createElement;
  const [query, setQuery] = React.useState("");
  const coFromCase = useCasePrefill(activeCase, caseToolDefaults(activeCase).company, query, setQuery);
  const [loading, setLoading] = React.useState(false);
  const [edgarResult, setEdgarResult] = React.useState(null);
  const [edgarError, setEdgarError] = React.useState(null);
  const [trialsResult, setTrialsResult] = React.useState(null);
  const [trialsError, setTrialsError] = React.useState(null);
  const [condQuery, setCondQuery] = React.useState("");
  const condFromCase = useCasePrefill(activeCase, caseToolDefaults(activeCase).indication, condQuery, setCondQuery);
  const [competitors, setCompetitors] = React.useState(null);
  const [competitorsError, setCompetitorsError] = React.useState(null);
  const [competitorsLoading, setCompetitorsLoading] = React.useState(false);
  const [exportCaseId, setExportCaseId] = useActiveCaseId(activeCase);
  const [exportMsg, setExportMsg] = React.useState(null);
  const [insiderResult, setInsiderResult] = React.useState(null);
  const [insiderError, setInsiderError] = React.useState(null);
  const [insiderLoading, setInsiderLoading] = React.useState(false);
  // Two lists, never merged: an executive spending their own money is a
  // decision; an option grant is compensation the board handed over.
  const [insiderView, setInsiderView] = React.useState("market");
  const isDesktop = typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;

  // Without these, correcting a search mid-flight ("Moderna" -> "Merck") let
  // whichever response happened to land last win, so the screen could show one
  // company's data under another company's name with nothing to indicate it.
  const searchSeq = React.useRef(0);
  const compSeq = React.useRef(0);
  // The Form 4 panel had neither: it survived a new search, so company A's
  // insiders rendered inside company B's EDGAR block, and a slow Form 4 fetch
  // could land after the user had moved on (FIN-005). A new search clears it
  // and advances insiderSeq, which drops any fetch still in flight.
  const insiderSeq = React.useRef(0);

  const search = async () => {
    if (!query.trim()) return;
    const myReq = ++searchSeq.current;
    insiderSeq.current++;
    setLoading(true); setEdgarError(null); setTrialsError(null); setEdgarResult(null); setTrialsResult(null); setExportMsg(null);
    setInsiderResult(null); setInsiderError(null); setInsiderLoading(false);
    // EDGAR first, so the trial search can use the company's registered name:
    // ClinicalTrials.gov knows sponsors by name, and a ticker ("STOK") found
    // no trials at all for a company with three.
    const edgarR = isDesktop ? await pullEdgarFinancials(query.trim(), false) : { ok: false, error: "EDGAR requires the desktop app." };
    if (myReq !== searchSeq.current) return;
    const trialsR = await searchTrialsBySponsor(edgarR.ok && edgarR.name ? sponsorNameFromEntity(edgarR.name) : query.trim(), 20);
    if (myReq !== searchSeq.current) return; // a newer search is already in flight
    if (edgarR.ok) setEdgarResult(edgarR); else setEdgarError(edgarR.error);
    if (trialsR.ok) setTrialsResult(trialsR); else setTrialsError(trialsR.error);
    setLoading(false);
  };

  const searchCompetitors = async () => {
    if (!condQuery.trim()) { setCompetitorsError("Enter an indication or condition."); return; }
    const myReq = ++compSeq.current;
    setCompetitorsLoading(true); setCompetitorsError(null);
    const r = await searchCompetitorLandscape(condQuery.trim(), null, 15);
    if (myReq !== compSeq.current) return;
    if (!r.ok) { setCompetitorsError(r.error); setCompetitors(null); setCompetitorsLoading(false); return; }
    if (isDesktop) { try { r.studies = await enrichSponsorsWithPublicStatus(r.studies); } catch (e) {} }
    if (myReq !== compSeq.current) return; // enrichment is a second await point
    setCompetitors(r);
    setCompetitorsLoading(false);
  };

  const exportToCase = () => {
    const c = cases.find(x => x.id === exportCaseId);
    if (!c || !edgarResult) return;
    const cap = c.capitalStructure || { mode: "simple" };
    const patch = { cash: edgarResult.cash != null ? String(edgarResult.cash) : cap.cash, debt: edgarResult.debt != null ? String(edgarResult.debt) : cap.debt,
      cashAsOf: edgarResult.cash != null && edgarResult.asOf ? edgarResult.asOf : cap.cashAsOf, monthlyBurn: edgarResult.quarterlyBurnUSD > 0 ? String(Math.round(edgarResult.quarterlyBurnUSD / 3)) : cap.monthlyBurn,
      cashSource: edgarResult.cash != null ? edgarCashSource(edgarResult) : cap.cashSource };
    if (cap.mode === "simple") {
      const fd = edgarFullyDilutedShares(edgarResult, c.currentPrice);
      patch.dilutedSharesSimple = fd ? String(fd.shares) : cap.dilutedSharesSimple;
    } else {
      patch.basicShares = edgarResult.basicShares != null ? String(edgarResult.basicShares) : cap.basicShares;
      if (edgarResult.options && edgarResult.options.count != null) patch.opts = String(edgarResult.options.count);
      if (edgarResult.options && edgarResult.options.avgStrike != null) patch.optK = String(edgarResult.options.avgStrike);
      if (edgarResult.warrants && edgarResult.warrants.count != null) patch.war = String(edgarResult.warrants.count);
      if (edgarResult.warrants && edgarResult.warrants.avgStrike != null) patch.warK = String(edgarResult.warrants.avgStrike);
      if (edgarResult.convertibleFace != null) patch.convFace = String(edgarResult.convertibleFace);
    }
    updateCase({
      ...c, capitalStructure: { ...cap, ...patch },
      programs: appendEdgarEvidenceToPrograms(c.programs, edgarResult, "Company Lookup's EDGAR pull"),
      updatedAt: Date.now()
    });
    setExportMsg("Exported to \"" + c.name + "\"");
  };

  const loadInsiderActivity = async () => {
    if (!edgarResult || !edgarResult.cik) return;
    const myReq = ++insiderSeq.current;
    setInsiderLoading(true); setInsiderError(null); setInsiderResult(null);
    let r;
    try { r = await fetchInsiderTransactions(edgarResult.cik, 20); }
    catch (e) { r = { ok: false, error: e.message }; }
    if (myReq !== insiderSeq.current) return; // a newer search or load has replaced this one
    if (r.ok) setInsiderResult(r); else setInsiderError(r.error || "Couldn't load insider activity.");
    setInsiderLoading(false);
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Search a company"),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        h("input", { type: "text", value: query, placeholder: "Company name or ticker", "aria-label": "Company name or ticker", onChange: e => setQuery(e.target.value),
          style: { flex: "1 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: search, disabled: loading,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer" }
        }, loading ? "Searching…" : "Search")
      ),
      h(CaseFilledNote, { activeCase, filled: [coFromCase && "ticker"] }),
      !isDesktop && h("div", { style: { ...UI.caption, marginBottom: 8 } }, "EDGAR financials require the desktop app — trial pipeline search works either way."),

      edgarResult && h("div", { style: { padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)", marginBottom: 10 } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 } }, "EDGAR financials"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.7 } },
          h("div", null, "✓ ", h("b", { style: { color: "var(--teal)" } }, edgarResult.name), " · CIK ", edgarResult.cik, edgarResult.ticker ? " · " + edgarResult.ticker : ""),
          // Every figure carries its own date: they come from different
          // filings (options are usually only tagged in the 10-K).
          h("div", null, "Basic shares: ", edgarResult.basicShares != null ? fmtNum(edgarResult.basicShares) + edgarAsOf(edgarResult.basicSharesAsOf) : "n/a"),
          edgarResult.dilutedShares != null && h("div", { title: "The weighted-average share count used for earnings per share. A loss-making company excludes options and warrants from it, so it is not a fully diluted count; the export builds that from basic shares, options and warrants instead." },
            "Weighted-average diluted, for EPS: ", fmtNum(edgarResult.dilutedShares), edgarAsOf(edgarResult.dilutedSharesAsOf), " — not a fully diluted count"),
          h("div", null, "Cash & marketable securities: ", edgarResult.cash != null ? fmtMoney(edgarResult.cash) + edgarAsOf(edgarResult.asOf) : "n/a", " · Debt: ", edgarResult.debt != null ? fmtMoney(edgarResult.debt) : "n/a"),
          edgarResult.cashTags && edgarResult.cashTags.length > 0 && h("div", { style: { color: "var(--ink-3)", fontSize: 10 } }, "Cash is " + edgarResult.cashTags.map(t => t.tag + " " + fmtMoney(t.value)).join(" + ") + " (XBRL tags)."),
          (edgarResult.options || edgarResult.warrants) && h("div", null,
            edgarResult.options && edgarResult.options.count != null && ("Options: " + fmtNum(edgarResult.options.count) + (edgarResult.options.priceFound ? " @ avg $" + edgarResult.options.avgStrike.toFixed(2) : " (strike not tagged)") + edgarAsOf(edgarResult.options.asOf)),
            edgarResult.options && edgarResult.warrants ? " · " : "",
            edgarResult.warrants && edgarResult.warrants.count != null && ("Warrants: " + fmtNum(edgarResult.warrants.count) + (edgarResult.warrants.priceFound ? " @ avg $" + edgarResult.warrants.avgStrike.toFixed(2) : " (strike not tagged)") + edgarAsOf(edgarResult.warrants.asOf))
          ),
          edgarResult.sourceFilingUrl && h("div", { style: { marginTop: 4 } }, h(ExternalLink, { href: edgarResult.sourceFilingUrl, style: { fontSize: 10 } }, "→ View source filing" + (edgarResult.sourceFilingLabel ? " (" + edgarResult.sourceFilingLabel + ")" : "")))
        ),
        h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--rule)" } },
          h(CasePicker, { cases, selectedId: exportCaseId, onChange: setExportCaseId }),
          h("button", { onClick: exportToCase, disabled: !exportCaseId,
            style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--amber)", background: "var(--amber-bg)", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: exportCaseId ? "pointer" : "default", opacity: exportCaseId ? 1 : 0.5 } }, "Export financials to case →"),
          exportMsg && h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)" } }, exportMsg)
        )
      ),
      edgarError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginBottom: 10 } }, edgarError),

      // Insider transactions (Form 4) — a separate, explicit action rather
      // than auto-loaded with the main search, since it's a genuinely
      // heavier call (one full-text search plus up to 20 individual XML
      // fetches, one per filing) than everything else on this tab.
      edgarResult && h("div", { style: { marginBottom: 10 } },
        !insiderResult && h("button", { onClick: loadInsiderActivity, disabled: insiderLoading,
          style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: insiderLoading ? "default" : "pointer" }
        }, insiderLoading ? "Loading insider activity…" : "Load insider activity (Form 4)"),
        insiderError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginTop: 6 } }, insiderError),
        insiderResult && (() => {
          // Split by WHAT THE TRANSACTION IS, not by which XML table it came
          // from. A restricted-stock award is filed in the non-derivative
          // table, so a naive derivative/non-derivative split puts a CEO's
          // 756,104-share grant under "bought and sold" — which is the exact
          // confusion this tab exists to prevent. Codes P and S are the only
          // two that mean somebody chose to transact at a market price;
          // everything else is an award, a vesting, a withholding, an exercise
          // or a transfer.
          const all = insiderResult.transactions || [];
          const market = all.filter(t => t.code === "P" || t.code === "S");
          const grants = all.filter(t => t.code !== "P" && t.code !== "S")
            .concat(insiderResult.derivativeTransactions || [])
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          const sum = insiderResult.openMarketSummary || {};
          const cl = insiderResult.buyCluster || findInsiderBuyCluster(insiderResult.transactions || []);
          const rows = insiderView === "market" ? market : grants;
          const tab = (key, label, n) => h("button", { key: key, onClick: () => setInsiderView(key),
            style: { padding: "4px 12px", borderRadius: 6, fontSize: 10, fontFamily: "var(--mono)", cursor: "pointer",
              border: "1px solid " + (insiderView === key ? "var(--teal)" : "var(--rule)"),
              background: insiderView === key ? "var(--teal-bg)" : "transparent",
              color: insiderView === key ? "var(--teal)" : "var(--ink-3)" } }, label + " (" + n + ")");
          return h("div", { style: { padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)", marginTop: 6 } },
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 } },
              "Insider transactions — " + insiderResult.filingsChecked + " most recent Form 4 filings"),

            // The headline is open-market activity only. A net figure that
            // folded in grants and tax withholding would be the standard way
            // this number stops meaning anything.
            cl && h("div", { className: "insider-cluster", style: { fontSize: 11, fontFamily: "var(--mono)", color: cl.kind === "cluster" ? "var(--teal)" : "var(--ink-2)", marginBottom: 6, lineHeight: 1.6 } },
              cl.kind === "cluster"
                ? cl.insiders + " insiders bought within 30 days (" + cl.start + " to " + cl.end + ") · " + cl.count + " purchases" + (cl.totalUsd ? " · " + fmtMoney(cl.totalUsd) + " total" : "") + "."
                : "One insider (" + cl.names[0] + "), " + cl.count + " purchases within 30 days (" + cl.start + " to " + cl.end + ")" + (cl.totalUsd ? " · " + fmtMoney(cl.totalUsd) : "") + " — usually one decision in tranches, not a cluster.",
              h("div", { style: { color: "var(--ink-3)", fontSize: 10 } }, "Open-market purchases as filed. Purchases under a pre-arranged 10b5-1 plan are not distinguished (that is in the filing's footnotes, which are not read).")),
            sum.any
              ? h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-1)", lineHeight: 1.7, marginBottom: 8 } },
                  h("div", null,
                    sum.boughtShares > 0
                      ? h("span", { style: { color: "var(--teal)" } }, "Bought " + fmtNum(sum.boughtShares) + " shares" + (sum.boughtUsd ? " (" + fmtMoney(sum.boughtUsd) + ")" : "") + " across " + sum.buyerCount + " insider" + (sum.buyerCount === 1 ? "" : "s"))
                      : h("span", { style: { color: "var(--ink-3)" } }, "No open-market buying"),
                    " · ",
                    sum.soldShares > 0
                      ? h("span", { style: { color: "var(--red)" } }, "sold " + fmtNum(sum.soldShares) + " shares" + (sum.soldUsd ? " (" + fmtMoney(sum.soldUsd) + ")" : "") + " across " + sum.sellerCount + " insider" + (sum.sellerCount === 1 ? "" : "s"))
                      : h("span", { style: { color: "var(--ink-3)" } }, "no open-market selling")))
              : h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", lineHeight: 1.6, marginBottom: 8 } },
                  "No open-market buying or selling in the filings checked" + (grants.length ? " — but " + grants.length + " award, vesting or exercise transaction" + (grants.length === 1 ? " was" : "s were") + " filed, on the other tab." : ".")),

            h("div", { style: { display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" } },
              tab("market", "Bought & sold", market.length),
              tab("grants", "Grants, vesting & options", grants.length)),

            rows.length === 0 && h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6 } },
              insiderView === "market"
                ? "No open-market purchases or sales in the filings checked. Awards, vesting and exercises, if any, are on the other tab."
                : "No awards, vesting, exercises or other non-market transactions in the filings checked."),

            h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" } },
              rows.map((t, i) => h("div", { key: i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "6px 0", borderBottom: "1px solid var(--rule)" } },
                h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
                  h("span", { style: { color: t.code === "P" ? "var(--green)" : t.code === "S" ? "var(--red)" : t.acquiredDisposed === "A" ? "var(--ink-1)" : "var(--ink-2)", fontWeight: 700 } }, t.codeLabel),
                  h("span", null, t.date), h("span", { style: { color: "var(--ink-3)" } }, "· " + t.ownerName + " (" + t.role + ")")),
                t.isDerivative
                  ? h("div", null,
                      fmtNum(t.shares) + " " + (t.securityTitle || "derivative securities")
                        + (t.strikePrice != null && t.strikePrice > 0 ? " · strike $" + t.strikePrice.toFixed(2) : t.strikePrice === 0 ? " · no exercise price (RSU-type)" : "")
                        + (t.underlyingShares != null && t.underlyingShares !== t.shares ? " · over " + fmtNum(t.underlyingShares) + " underlying shares" : "")
                        + (t.expiresOn ? " · expires " + t.expiresOn : ""),
                      h(ExternalLink, { href: t.sourceUrl, style: { fontSize: 10, marginLeft: 8 } }, "→ Filing"))
                  : h("div", null,
                      fmtNum(t.shares) + " shares" + (t.pricePerShare ? " @ $" + t.pricePerShare.toFixed(2) : "") + (t.valueUsd ? " (" + fmtMoney(t.valueUsd) + ")" : ""),
                      h(ExternalLink, { href: t.sourceUrl, style: { fontSize: 10, marginLeft: 8 } }, "→ Filing"))
              ))),

            h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 8 } },
              insiderView === "market"
                ? "Only codes P and S: an insider deciding to buy or sell at a market price with their own money. That is the part of a Form 4 with any signal in it, and it is why everything else lives on the other tab."
                : "Compensation, not conviction — an award is something the board decided, not something the insider bought, and a tax withholding is not a decision to sell. Restricted stock arrives in the same table as an ordinary purchase in the filing itself, which is exactly why these are separated by what the transaction is rather than by where it sits in the XML. Option grants carry no dollar value here: a grant's registered price is normally zero, and a notional built from a market price this tool does not have would be a made-up number. An exercise followed by a same-day sale appears here as the exercise and on the other tab as the sale.")
          );
        })()
      ),

      trialsResult && h("div", { style: { padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 } }, "Trial pipeline (" + trialsResult.studies.length + ")"),
        trialsResult.studies.length === 0 && h("div", { style: UI.captionMd }, "No trials found with that sponsor name on ClinicalTrials.gov."),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" } },
          trialsResult.studies.map((s, i) => h("div", { key: i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "6px 0", borderBottom: "1px solid var(--rule)" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
              h("span", { style: { color: "var(--ink-1)" } }, s.nctId + " · " + s.phase + " · " + s.status),
              s.hasResults && h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + s.nctId + "?tab=results", style: { fontSize: 10, color: "var(--teal)", fontWeight: 700 } }, "✓ Results posted →"),
              onWatchTrial && h("span", { onClick: () => onWatchTrial(s.nctId),
                role: "button", tabIndex: 0,
                onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatchTrial(s.nctId); } },
                style: { fontSize: 10, color: "var(--ink-3)", cursor: "pointer", textDecoration: "underline" } }, "Watch this trial →")),
            h("div", null, (s.interventions[0] || s.title) + " — " + (s.conditions[0] || ""))
          ))
        )
      ),
      trialsError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)" } }, trialsError)
    ]),
    toolCard(h, [
      toolLabel(h, "Competitor search by indication"),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 10 } }, "Who else is developing a drug in this indication. Cross-references sponsors against EDGAR when running as the desktop app."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        h("input", { type: "text", "aria-label": "Indication or condition", value: condQuery, placeholder: "Indication / condition", onChange: e => setCondQuery(e.target.value),
          style: { flex: "1 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: searchCompetitors, disabled: competitorsLoading,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--amber)", background: "var(--amber-bg)", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: competitorsLoading ? "default" : "pointer" }
        }, competitorsLoading ? "Searching…" : "Search")
      ),
      h(CaseFilledNote, { activeCase, filled: [condFromCase && "indication"] }),
      competitorsError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginBottom: 8 } }, competitorsError),
      competitors && h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
        competitors.studies.length === 0 && h("div", { style: UI.captionMd }, "No trials found for that indication."),
        competitors.studies.map((s, i) => h("div", { key: i, style: { padding: "8px 12px", borderRadius: 6, background: "var(--surface-2)", fontSize: 11, fontFamily: "var(--mono)" } },
          h("div", { style: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 } },
            h("div", { style: { color: "var(--ink-1)", fontWeight: 700 } }, s.sponsor || "(sponsor not listed)"),
            s.publicStatus && s.publicStatus.isPublic != null && h("span", {
              style: { fontSize: 10, padding: "2px 8px", borderRadius: 10, background: s.publicStatus.isPublic ? "var(--teal-bg)" : "var(--surface)", color: s.publicStatus.isPublic ? "var(--teal)" : "var(--ink-3)", border: "1px solid " + (s.publicStatus.isPublic ? "var(--teal)" : "var(--rule)") }
            }, s.publicStatus.isPublic ? "Public" + (s.publicStatus.ticker ? " · " + s.publicStatus.ticker : "") : "Private/not found")
          ),
          h("div", { style: { color: "var(--ink-2)", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
            h("span", null, (s.interventions[0] || s.title) + " · " + s.phase + " · " + s.status),
            s.hasResults && h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + s.nctId + "?tab=results", style: { fontSize: 10, color: "var(--teal)", fontWeight: 700 } }, "✓ Results posted →"))
        ))
      )
    ])
  );
}

// ── Catalyst Calendar: pulls upcoming events across multiple cases at once.
// HONEST SCOPE: there is no public, structured API for actual PDUFA/FDA
// decision dates — those get reported by companies via press release/8-K only
// once announced, not published anywhere queryable in advance. What IS
// genuinely available: each trial's own estimated completion date from
// ClinicalTrials.gov (a real signal for "when might we see a readout"), and
// each company's most recent SEC filings for context on what's already
// happened. This tool is upfront about that distinction rather than implying
// more certainty than the data supports.
function CatalystCalendarTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  // Starts on the open case only (tick others in to widen it), and moves with
  // it when the case is switched.
  const [selectedIds, setSelectedIds] = React.useState(() => new Set(activeCase ? [activeCase.id] : cases.map(c => c.id)));
  React.useEffect(() => { if (activeCase) setSelectedIds(new Set([activeCase.id])); }, [activeCase && activeCase.id]);
  const [loading, setLoading] = React.useState(false);
  const [upcomingEvents, setUpcomingEvents] = React.useState(null);
  const [recentFilings, setRecentFilings] = React.useState(null);
  const [catalystFilings, setCatalystFilings] = React.useState(null);
  const [error, setError] = React.useState(null);
  const reqSeq = React.useRef(0);
  const isDesktop = typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;

  const toggleCase = (id) => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const pullEvents = async () => {
    const myReq = ++reqSeq.current;
    setLoading(true); setError(null); setUpcomingEvents(null); setRecentFilings(null); setCatalystFilings(null);
    const selectedCases = cases.filter(c => selectedIds.has(c.id));
    const today = new Date();
    // Per-source failure counts. Every one of these used to be dropped on the
    // floor, so a total outage produced "No future-dated trial completion
    // estimates found" — visually identical to a genuinely quiet calendar.
    let ctTried = 0, ctFailed = 0, edgarTried = 0, edgarFailed = 0;

    // CT.gov: upcoming trial completion estimates, per program
    const trialPromises = [];
    selectedCases.forEach(c => c.programs.forEach(p => {
      if (p.drugName && p.drugName.trim()) {
        ctTried++;
        trialPromises.push(
          searchTrialsForDrug(p.drugName, 5)
            .then(r => ({ caseName: c.name, progName: p.drugName, result: r }))
            .catch(e => ({ caseName: c.name, progName: p.drugName, result: { ok: false, error: e && e.message } }))
        );
      }
    }));
    const trialResults = await Promise.all(trialPromises);
    if (myReq !== reqSeq.current) return; // superseded by a newer pull
    const events = [];
    trialResults.forEach(({ caseName, progName, result }) => {
      if (!result.ok) { ctFailed++; return; }
      result.studies.forEach(s => {
        const dateStr = s.primaryCompletionDate || s.completionDate;
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (isNaN(d.getTime()) || d < today) return; // only future estimates
        events.push({ caseName, progName, date: dateStr, dateObj: d, nctId: s.nctId, phase: s.phase, status: s.status, title: s.title, hasResults: s.hasResults });
      });
    });
    events.sort((a, b) => a.dateObj - b.dateObj);
    setUpcomingEvents(events);

    // EDGAR: recent filings + catalyst-keyword full-text search, per case (desktop only)
    if (isDesktop) {
      const filingPromises = selectedCases.filter(c => c.ticker || c.name).map(c => {
        edgarTried++;
        return pullEdgarFinancials(c.ticker || c.name, false)
          .then(r => ({ caseName: c.name, result: r }))
          .catch(e => ({ caseName: c.name, result: { ok: false, error: e && e.message } }));
      });
      const filingResults = await Promise.all(filingPromises);
      if (myReq !== reqSeq.current) return;
      const filings = [];
      filingResults.forEach(({ caseName, result }) => {
        // Only a reachability failure counts against us here — a company that
        // genuinely has no CIK is a real answer, not an outage.
        if (!result.ok) { if (result.unreachable) edgarFailed++; return; }
        (result.recentFilings || []).forEach(f => filings.push({ caseName, ...f }));
      });
      filings.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentFilings(filings);

      // Catalyst-keyword search: resolve each case's CIK, then search its own
      // filing TEXT for catalyst language (PDUFA, topline, advisory committee,
      // etc.) rather than just listing recent filings by type.
      const catalystPromises = selectedCases.filter(c => c.ticker || c.name).map(async c => {
        try {
          const cikInfo = await findCIK(c.ticker || c.name);
          if (!cikInfo || !cikInfo.cik) return { caseName: c.name, hits: [] };
          const r = await searchCatalystFilings(cikInfo.cik, 12);
          return { caseName: c.name, hits: r.ok ? r.hits : [], failed: !r.ok };
        } catch (e) { return { caseName: c.name, hits: [], failed: true }; }
      });
      const catalystResults = await Promise.all(catalystPromises);
      if (myReq !== reqSeq.current) return;
      const catalystHits = [];
      catalystResults.forEach(({ caseName, hits, failed }) => {
        if (failed) edgarFailed++;
        hits.forEach(h => catalystHits.push({ caseName, ...h }));
      });
      catalystHits.sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate));
      setCatalystFilings(catalystHits);
    }

    // Say so when the empty result below is actually a failed lookup. Without
    // this, an outage and a genuinely quiet calendar render identically.
    const parts = [];
    if (ctTried && ctFailed) parts.push(ctFailed === ctTried
      ? "none of the " + ctTried + " ClinicalTrials.gov lookups succeeded"
      : ctFailed + " of " + ctTried + " ClinicalTrials.gov lookups failed");
    if (edgarTried && edgarFailed) parts.push(edgarFailed >= edgarTried
      ? "SEC EDGAR could not be reached"
      : "some SEC EDGAR lookups failed");
    if (parts.length) setError("Incomplete results — " + parts.join(", ") + ". Anything missing below may be a connection problem rather than a genuinely empty calendar.");

    setLoading(false);
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Catalyst calendar"),
      h("div", { style: UI.intro },
        "Pulls estimated trial completion dates from ClinicalTrials.gov, plus searches each company's own SEC filings for catalyst language (PDUFA, topline results, advisory committee, breakthrough/priority designations) instead of just listing recent filings by type. ",
        h("b", { style: { color: "var(--warn)" } }, "Worth knowing: "), "there's still no public structured API for actual PDUFA/FDA decision dates — a filing search finds where a company has already *mentioned* one, not a calendar of dates that haven't been announced yet."),

      h("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, maxHeight: 150, overflowY: "auto" } },
        cases.map(c => h("label", { key: c.id, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)", cursor: "pointer" } },
          h("input", { type: "checkbox", checked: selectedIds.has(c.id), onChange: () => toggleCase(c.id) }),
          caseDisplayName(c) + " — " + c.programs.length + " program" + (c.programs.length !== 1 ? "s" : "")
        )),
        cases.length === 0 && h("div", { style: UI.captionMd }, "No cases yet — create one in Workspace first.")
      ),

      h("button", { onClick: pullEvents, disabled: loading || selectedIds.size === 0,
        style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer" }
      }, loading ? "Pulling…" : "Pull events"),
      error && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginTop: 10 } }, error)
    ]),

    // The user's own pinned dates first: they need no lookup, and they are
    // the dates the rest of the app uses.
    (() => {
      const pins = [];
      cases.filter(c => selectedIds.has(c.id)).forEach(c => (c.programs || []).forEach(p => (p.calibrationLog || []).forEach(e => {
        if (!e.pin || (e.outcome && e.outcome !== "pending") || e.closeOut) return;
        const w = parseCatalystWindow(e.catalystDate);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (w && w.end < today) return;   // behind it: the Calibration banner asks for the result
        pins.push({ c, p, e, w });
      })));
      if (!pins.length) return null;
      pins.sort((a, b) => (a.w ? a.w.start.getTime() : Infinity) - (b.w ? b.w.start.getTime() : Infinity));
      return toolCard(h, [
        toolLabel(h, "Your pinned catalysts (" + pins.length + ")"),
        h("div", { style: { ...UI.caption, marginBottom: 10 } }, "Dates you pinned in a case's Calibration Log, with their source. Runway vs. Catalyst and the failure floor use these ahead of the registry estimates below."),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
          pins.map((x, i) => h("div", { key: i, style: { padding: "8px 12px", borderRadius: 6, background: "var(--surface-2)", fontSize: 11, fontFamily: "var(--mono)" } },
            h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10 } },
              h("span", { style: { color: "var(--teal)", fontWeight: 700 } }, (x.e.catalystDate || "undated") + " · " + catalystPinLabel(x.e.pin)),
              h("span", { style: { color: "var(--ink-3)" } }, caseDisplayName(x.c) + " · " + (x.p.drugName || x.p.name || "Program"))),
            h("div", { style: { color: "var(--ink-1)", marginTop: 2 } }, x.e.catalystLabel),
            h("div", { style: { color: "var(--ink-3)", marginTop: 2 } }, "Source: " + (x.e.pin.source || "not given") + (x.e.pin.at ? " · pinned " + x.e.pin.at : ""))))
        )
      ]);
    })(),

    upcomingEvents && toolCard(h, [
      toolLabel(h, "Upcoming — estimated trial completions (" + upcomingEvents.length + ")"),
      h("div", { style: { ...UI.caption, marginBottom: 10 } }, "A registry completion date is when a trial expects to stop collecting data for its primary endpoint. Results usually follow months later, so it is not a readout date."),
      upcomingEvents.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No future-dated trial completion estimates found for these programs."),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" } },
        upcomingEvents.map((e, i) => h("div", { key: i, style: { padding: "8px 12px", borderRadius: 6, background: "var(--surface-2)", fontSize: 11, fontFamily: "var(--mono)" } },
          h("div", { style: { display: "flex", justifyContent: "space-between" } },
            h("span", { style: { color: "var(--teal)", fontWeight: 700 } }, e.date),
            h("span", { style: { color: "var(--ink-3)" } }, e.caseName + " · " + e.progName)),
          h("div", { style: { color: "var(--ink-1)", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
            h("span", null, e.nctId + " · " + e.phase + " · " + e.status),
            e.hasResults && h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + e.nctId + "?tab=results", style: { fontSize: 10, color: "var(--teal)", fontWeight: 700 } }, "✓ Results posted →")),
          h("div", { style: { color: "var(--ink-2)", marginTop: 2 } }, e.title)
        ))
      )
    ]),

    catalystFilings && toolCard(h, [
      toolLabel(h, "Catalyst-language filings (" + catalystFilings.length + ")"),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 10 } },
        "Filings from the last 12 months whose text matches catalyst-relevant language (PDUFA, topline results, advisory committee, breakthrough/priority/fast-track designations, NDA/BLA submissions)."),
      catalystFilings.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No catalyst-language matches found in the last 12 months."),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" } },
        catalystFilings.map((f, i) => h("div", { key: i, style: { padding: "8px 12px", borderRadius: 6, background: "var(--surface-2)", fontSize: 11, fontFamily: "var(--mono)" } },
          h("div", { style: { display: "flex", justifyContent: "space-between" } },
            h("span", { style: { color: "var(--ink-1)", fontWeight: 700 } }, f.fileDate + " · " + f.formType),
            h("span", { style: { color: "var(--ink-3)" } }, f.caseName)),
          f.filingUrl && h(ExternalLink, { href: f.filingUrl, style: { fontSize: 10, marginTop: 2, display: "inline-block" } }, "→ View filing")
        ))
      )
    ]),

    recentFilings && toolCard(h, [
      toolLabel(h, "Recent SEC filings (" + recentFilings.length + ")"),
      recentFilings.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No recent filings found."),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" } },
        recentFilings.map((f, i) => h("div", { key: i, style: { padding: "6px 12px", borderRadius: 6, background: "var(--surface-2)", fontSize: 11, fontFamily: "var(--mono)", display: "flex", justifyContent: "space-between" } },
          h("span", { style: { color: "var(--ink-1)" } }, f.date + " · " + f.form),
          h("span", { style: { color: "var(--ink-3)" } }, f.caseName)
        ))
      )
    ]),
    !isDesktop && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", padding: "0 4px" } }, "SEC filing search (recent filings and catalyst-language matches) requires the desktop app — trial completion estimates work either way.")
  );
}

// ── Cash Runway / Burn Rate ──
function RunwayTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [companyName, setCompanyName] = React.useState("");
  const runwayFromCase = useCasePrefill(activeCase, caseToolDefaults(activeCase).company, companyName, setCompanyName);
  const [pulling, setPulling] = React.useState(false);
  const [pullError, setPullError] = React.useState(null);
  const [pullResult, setPullResult] = React.useState(null);
  const [manualCash, setManualCash] = React.useState("");
  const [manualMonthlyBurn, setManualMonthlyBurn] = React.useState("");
  // The open case's own cash and monthly burn (dollars, as MillionsField
  // stores them) — both as of the case's balance-sheet date.
  const capS = (activeCase && activeCase.capitalStructure) || {};
  const cashFromCase = useCasePrefill(activeCase, String(capS.cash || ""), manualCash, setManualCash);
  const burnFromCase = useCasePrefill(activeCase, String(capS.monthlyBurn || ""), manualMonthlyBurn, setManualMonthlyBurn);
  const [exportCaseId, setExportCaseId] = useActiveCaseId(activeCase);
  const [exportMsg, setExportMsg] = React.useState(null);
  const [forwardCaseId, setForwardCaseId] = useActiveCaseId(activeCase);
  const isDesktop = typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;

  const pull = async () => {
    if (!companyName.trim()) { setPullError("Enter a company name or ticker first."); return; }
    if (!isDesktop) { setPullError("EDGAR pull requires the desktop app — use manual entry below instead."); return; }
    setPulling(true); setPullError(null); setExportMsg(null);
    const r = await pullEdgarFinancials(companyName.trim(), false);
    if (!r.ok) { setPullError(r.error); setPullResult(null); } else { setPullResult(r); }
    setPulling(false);
  };

  const manualCashNum = Number(manualCash) || 0;
  const manualBurnNum = Number(manualMonthlyBurn) || 0;
  const manualRunway = manualBurnNum > 0 ? manualCashNum / manualBurnNum : null;

  const exportToCase = () => {
    const c = cases.find(x => x.id === exportCaseId);
    if (!c) return;
    const cash = pullResult ? pullResult.cash : (manualCashNum || null);
    const debt = pullResult ? pullResult.debt : null;
    if (cash == null) return;
    const cap = c.capitalStructure || {};
    updateCase({
      ...c, capitalStructure: { ...cap, cash: String(cash), debt: debt != null ? String(debt) : cap.debt,
        cashAsOf: pullResult && pullResult.asOf ? pullResult.asOf : cap.cashAsOf, monthlyBurn: pullResult && pullResult.quarterlyBurnUSD > 0 ? String(Math.round(pullResult.quarterlyBurnUSD / 3)) : cap.monthlyBurn,
        cashSource: pullResult ? edgarCashSource(pullResult) : "typed in Cash Runway" },
      programs: appendEdgarEvidenceToPrograms(c.programs, pullResult, "Cash Runway's EDGAR pull"),
      updatedAt: Date.now()
    });
    setExportMsg("Exported to \"" + c.name + "\"");
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Cash runway — pull from EDGAR"),
      h("div", { style: { marginBottom: 10 } },
        h(Note, { summary: 'New here? Trailing vs. forward runway' },
          h("div", { style: { lineHeight: 1.6 } }, 'Two different numbers, both useful. Trailing runway divides the last reported cash balance by recent actual burn from EDGAR filings — it answers "at the rate they have really been spending, how long does the money last?" Forward runway instead uses this case\'s own modeled R&D and G&A costs, which is the right basis when you expect spending to change: a company about to start a Phase 3 will burn far more than its trailing rate implies. Neither knows about an ATM facility, an undrawn credit line, or partnership milestone cash, all of which extend the line.'))),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12 } }, "Latest reported cash and marketable securities, and the cash the business used in operations (from the cash-flow statement — operating loss only when that is not tagged), converted to a runway estimate."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        h("input", { type: "text", value: companyName, placeholder: "Company name or ticker", "aria-label": "Company name or ticker", onChange: e => setCompanyName(e.target.value),
          style: { flex: "1 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: pull, disabled: pulling,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: pulling ? "default" : "pointer" } }, pulling ? "Pulling…" : "Pull from EDGAR")
      ),
      h(CaseFilledNote, { activeCase, filled: [runwayFromCase && "ticker"] }),
      !isDesktop && h("div", { style: { ...UI.caption, marginBottom: 8 } }, "Requires the desktop app — use manual entry below in the meantime."),
      pullError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginBottom: 10 } }, pullError),

      pullResult && h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 8 } }, "✓ ", h("b", { style: { color: "var(--teal)" } }, pullResult.name), pullResult.asOf ? " · as of " + pullResult.asOf : ""),
        h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" } },
          h("div", null, h("div", { style: UI.caption }, "Cash & investments"),
            h("div", { style: UI.stat }, pullResult.cash != null ? fmtMoney(pullResult.cash) : "n/a"),
            pullResult.cashTags && pullResult.cashTags.length > 0 && h("div", { style: { ...UI.caption, maxWidth: 260 } }, pullResult.cashTags.map(t => t.tag + " " + fmtMoney(t.value)).join(" + "))),
          h("div", null, h("div", { style: UI.caption }, "Quarterly burn"),
            h("div", { style: UI.stat }, pullResult.quarterlyBurnUSD != null ? fmtMoney(pullResult.quarterlyBurnUSD) : "n/a"),
            pullResult.burnBasis && h("div", { style: UI.caption }, pullResult.burnBasis + (pullResult.burnPeriodMonths ? ", " + pullResult.burnPeriodMonths + " months" + (pullResult.burnPeriodEnd ? " to " + pullResult.burnPeriodEnd : "") + (pullResult.burnPeriodMonths !== 3 ? ", per quarter" : "") : ""))),
          h("div", null, h("div", { style: UI.caption }, "Runway"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: pullResult.runwayMonths != null && pullResult.runwayMonths < 12 ? "var(--red)" : "var(--green)" } },
              pullResult.runwayMonths != null ? pullResult.runwayMonths.toFixed(0) + " mo" : "n/a"))
        ),
        pullResult.runwayNote && h("div", { style: { ...UI.caption, marginTop: 8 } }, pullResult.runwayNote)
      )
    ]),
    toolCard(h, [
      toolLabel(h, "Manual entry"),
      h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 } },
        h(MillionsField, { label: "Cash & investments", value: manualCash, onChange: setManualCash }),
        h(MillionsField, { label: "Monthly burn", value: manualMonthlyBurn, onChange: setManualMonthlyBurn })
      ),
      h(CaseFilledNote, { activeCase, filled: [cashFromCase && "cash", burnFromCase && "monthly burn"] }),
      h("div", null, h("div", { style: UI.caption }, "Runway"),
        h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: manualRunway != null && manualRunway < 12 ? "var(--red)" : "var(--green)" } },
          manualRunway != null ? manualRunway.toFixed(0) + " months" : "—"))
    ]),

    // Forward-looking runway — from the case's own model (R&D cost timeline,
    // corporate G&A), not trailing EDGAR data. Deliberately UNRISKED (see
    // computeForwardRunway) since this answers "if the current plan
    // proceeds, when do we run out of cash," not an expected-value question.
    (() => {
      const fc = cases.find(c => c.id === forwardCaseId);
      let fr = null, frError = null;
      if (fc) {
        try { fr = computeForwardRunway(fc); } catch (e) { frError = e.message; }
      }
      return toolCard(h, [
        toolLabel(h, "Forward-looking runway — from your model"),
        h("div", { style: UI.intro },
          "Projects the case's own cash balance forward using its modeled R&D-to-launch cost timeline and corporate G&A — not the trailing EDGAR burn rate above. Deliberately unrisked (full cost, full revenue, no PoS-weighting): this answers \"if the current plan proceeds, when do we run out of money,\" which is a cash-forecasting question, not a valuation one. Starting cash is gross, not net of debt."),
        h(CasePicker, { cases, selectedId: forwardCaseId, onChange: setForwardCaseId }),
        fc && h(IncludeInReportToggle, { theCase: fc, updateCase, reportKey: "cashRunway", label: "Include cash balance chart in PDF report" }),
        frError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginTop: 10 } }, "Calculation error: " + frError),
        fr && !frError && h("div", { style: { marginTop: 14 } },
          h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14 } },
            h("div", null, h("div", { style: UI.caption }, "Starting cash" + (fr.cashAsOf ? " (" + fr.cashAsOf + ")" : "")),
              h("div", { style: UI.stat }, fmtMoney(fr.startingCash))),
            h("div", null, h("div", { style: UI.caption }, "Modeled runway"),
              h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: fr.runwayMonths != null && fr.runwayMonths < 12 ? "var(--red)" : "var(--green)" } },
                fr.runwayMonths != null ? fr.runwayMonths.toFixed(0) + " mo" : "25yr+ (beyond projection window)")),
            (() => {
              const fac = caseFacilities(fc);
              // A runway with no end cannot get longer, so the figure would only repeat it.
              if (!(fac.total > 0) || fr.runwayMonths == null) return null;
              const frF = computeForwardRunway(fc, { extraCash: fac.total });
              return h("div", { title: fac.note || undefined }, h("div", { style: UI.caption }, "With facilities"),
                h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-2)" } }, frF.runwayMonths != null ? frF.runwayMonths.toFixed(0) + " mo" : "25yr+"),
                h("div", { style: UI.caption }, "+ " + fmtMoney(fac.total) + " " + facilitiesPhrase(fac)));
            })()
          ),
          h(ExportableBlock, { title: (fc ? fc.name + " — " : "") + "cash runway" },
            h(RevenueChart, {
              series: [{ name: "Projected cash balance", color: "var(--teal)", points: fr.path.map(p => ({ v: p.balanceEnd, label: p.year })) }],
              height: 160, showLegend: false
            })),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 4 } }, "Below the zero line is the cumulative cash the plan would need raised — the model never raises money on its own, so where the line crosses zero is when a raise becomes necessary." +
            (fr.monthsSinceCash >= 0.5 ? " The balance is the " + fr.cashAsOf + " filing's, so the runway is counted from today: the " + fr.monthsSinceCash.toFixed(1) + " months since then are taken off." : "")),
          h(Explain, readForwardRunway(fr.runwayMonths, fr.path))
        )
      ]);
    })(),

    // An action, not a result: a row under the cards rather than a card of
    // its own (which also gave it an Export button with nothing to export).
    (pullResult || manualCashNum > 0) && h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "0 0 16px" } },
        h(CasePicker, { cases, selectedId: exportCaseId, onChange: setExportCaseId }),
        h("button", { onClick: exportToCase, disabled: !exportCaseId,
          style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--amber)", background: "var(--amber-bg)", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: exportCaseId ? "pointer" : "default", opacity: exportCaseId ? 1 : 0.5 } }, "Export cash/debt to case →"),
        exportMsg && h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)" } }, exportMsg)
    )
  );
}

// ── Runway vs. Catalyst ────────────────────────────────────────────────────
// Answers the question that breaks more retail biotech theses than bad
// science: can this company actually reach its next readout without raising?
// Both halves already existed and were never crossed — runway from the case's
// own modeled burn (computeForwardRunway), catalyst dates from each program's
// calibration log. Import-only for the same reason SensitivityTool is: there
// is no meaningful standalone answer without a case's own burn and dates.
function RunwayVsCatalystTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [caseId, setCaseId] = useActiveCaseId(activeCase);
  const [cushion, setCushion] = React.useState("6");
  const theCase = cases.find(c => c.id === caseId);
  const rvcRef = React.useRef(null);
  const cushionNum = cushion === "" ? 0 : Number(cushion);
  const res = theCase ? computeRunwayVsCatalysts(theCase, { cushionMonths: isFinite(cushionNum) ? cushionNum : 6 }) : null;
  // The same check if the undrawn ATM, debt and expected milestones come in.
  const fac = theCase ? caseFacilities(theCase) : null;
  const resFac = theCase && fac.total > 0 ? computeRunwayVsCatalysts(theCase, { cushionMonths: isFinite(cushionNum) ? cushionNum : 6, withFacilities: true }) : null;
  let bridge = null;
  try { bridge = theCase && res && res.ok ? computeFinancingBridge(theCase, { cushionMonths: isFinite(cushionNum) ? cushionNum : 6 }) : null; } catch (e) { bridge = null; }
  const [confirmRaise, setConfirmRaise] = React.useState(false);
  const [raiseMsg, setRaiseMsg] = React.useState("");

  const STATUS = {
    funded: { color: "var(--teal)", word: "Funded through it" },
    tight:  { color: "var(--warn)", word: "Reaches it, but on fumes" },
    inside: { color: "var(--red)", word: "Runs out inside the window" },
    gap:    { color: "var(--red)", word: "Runs out first" }
  };
  const fmtMonths = m => (m >= 0 ? "" : "−") + Math.abs(m).toFixed(1) + " mo";

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Runway vs. catalyst"),
      h("div", { style: UI.intro },
        "Does the company reach its next readout without having to raise first? A financing on the last few months of cash lands before any upside, usually at a discount."),
      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
        h(CasePicker, { cases, selectedId: caseId, onChange: setCaseId }),
        h("label", { style: { display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)" } },
          "Cushion required at readout",
          h("input", { type: "number", value: cushion, min: 0, step: 1, "aria-label": "Cushion required at readout (months)", onChange: e => setCushion(e.target.value),
            style: { width: 62, padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } }),
          "mo")
      )
    ]),

    !theCase && toolCard(h, [h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-3)" } },
      "Pick a case. It needs starting cash and a cost model (for runway), plus at least one calibration-log entry with a date like 2027-03-15, 2027-Q2 or H1 2027 (for the catalyst).")]),

    theCase && res && !res.ok && toolCard(h, [
      h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--warn)" } }, res.error)
    ]),

    theCase && res && res.ok && h("div", { ref: rvcRef }, toolCard(h, [
      toolLabel(h, (theCase.name || "This case") + " — does the cash reach the next catalyst?"),
      h("div", { style: { display: "flex", gap: 26, flexWrap: "wrap", marginBottom: 14 } },
        h("div", null,
          h("div", { style: UI.caption }, "Modeled runway"),
          h("div", { style: { fontSize: 26, fontFamily: "var(--mono)", fontWeight: 800, color: (!res.beyondHorizon && res.runwayMonths < 12) ? "var(--red)" : "var(--green)" } },
            res.beyondHorizon ? "No end" : res.runwayMonths.toFixed(0) + " mo"),
          res.beyondHorizon && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", maxWidth: 150, lineHeight: 1.4 } },
            "modeled cash flow turns positive before cash runs out"),
          !res.beyondHorizon && res.monthsSinceCash >= 0.5 && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", maxWidth: 150, lineHeight: 1.4 } },
            "from today, on the " + res.cashAsOf + " cash")),
        h("div", null,
          h("div", { style: UI.caption }, "Dated catalysts"),
          h("div", { style: { fontSize: 26, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, String(res.rows.length))),
        resFac && resFac.ok && !res.beyondHorizon && h("div", { title: fac.note || undefined },
          h("div", { style: UI.caption }, "With facilities"),
          h("div", { style: { fontSize: 26, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-2)" } },
            resFac.beyondHorizon ? "No end" : resFac.runwayMonths.toFixed(0) + " mo"),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", maxWidth: 170, lineHeight: 1.4 } },
            "+ " + fmtMoney(fac.total) + " " + facilitiesPhrase(fac))),
        res.gapCount > 0 && h("div", null,
          h("div", { style: UI.caption }, "UNFUNDED"),
          h("div", { style: { fontSize: 26, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--red)" } }, String(res.gapCount)))
      ),

      // The headline judgment, stated in words rather than left to be inferred
      // from the chart.
      res.rows.length === 0
        ? h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)", fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 } },
            "No dated catalysts on this case yet. Add one in a program's calibration log with a date like \"2027-03-15\", \"2027-Q2\", \"H1 2027\" or \"2027\" — prose such as \"sometime next year\" is left undated rather than guessed at."
            + (res.undatedCount ? " (" + res.undatedCount + " undated prediction" + (res.undatedCount > 1 ? "s" : "") + " skipped.)" : ""))
        : h("div", { style: {
            padding: "12px 14px", borderRadius: 8, lineHeight: 1.65, fontFamily: "var(--sans)", fontSize: 12,
            background: res.firstProblem ? (res.firstProblem.status === "gap" ? "var(--red-bg)" : "var(--warn-bg)") : "var(--green-bg)",
            border: "1px solid " + (res.firstProblem ? STATUS[res.firstProblem.status].color : "var(--teal)"),
            color: "var(--ink-1)"
          } },
            res.firstProblem
              ? h("span", null,
                  h("b", { style: { color: STATUS[res.firstProblem.status].color } },
                    res.firstProblem.status === "gap" ? "Financing needed before the readout. "
                      : res.firstProblem.status === "inside" ? "The cash runs out inside the readout's window. "
                      : "Reaches the readout with very little left. "),
                  "\"", res.firstProblem.label, "\" (", res.firstProblem.programName, ") is ",
                  res.firstProblem.status === "inside" || (res.firstProblem.monthsToStart < res.firstProblem.monthsAway - 0.5)
                    ? "expected " + Math.max(0, res.firstProblem.monthsToStart).toFixed(1) + "–" + res.firstProblem.monthsAway.toFixed(1) + " months out (" + res.firstProblem.dateText + ")"
                    : res.firstProblem.monthsAway.toFixed(1) + " months out",
                  ", against ", res.runwayMonths.toFixed(1), " months of runway — ",
                  res.firstProblem.status === "gap"
                    ? "about " + Math.abs(res.runwayMonths - res.firstProblem.monthsToStart).toFixed(1) + " months short of the window even opening. Expect a raise before the catalyst, and size the dilution into your entry rather than after it."
                    : res.firstProblem.status === "inside"
                      ? "if it comes early in the window the cash just reaches it; if late, a raise comes first. Either way there is no cushion."
                      : "roughly " + res.firstProblem.cushionAtCatalyst.toFixed(1) + " months of cash left at the end of it, below the " + res.cushionMonths + "-month cushion. A company this close to the line usually finances ahead of the event anyway.")
              : h("span", null,
                  h("b", { style: { color: "var(--teal)" } }, "Funded through every dated catalyst. "),
                  res.beyondHorizon
                    ? "This case never runs out of cash in the 25-year projection — modeled cash flow turns positive first, so no dated catalyst is financing-constrained. That is a property of your revenue assumptions, so it is only as safe as they are."
                    : "Runway covers all " + res.rows.length + " with at least the " + res.cushionMonths + "-month cushion. That removes forced-financing risk from the thesis — it does not remove the risk of an opportunistic raise into strength.")
          ),

      // How much a raise would need to be, and what it does to a share.
      bridge && h("div", { className: "financing-bridge", style: { marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)", fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.65, color: "var(--ink-1)" } },
        h("div", { style: { fontWeight: 700, marginBottom: 4 } }, "What reaching it would take"),
        h("div", null, "About ", h("b", null, fmtMoney(bridge.needed)), " to get past the end of \"" + bridge.catalyst.label.split(/[,(]/)[0].trim() + "\" (" + bridge.catalyst.dateText + ") with the " + bridge.cushionMonths + "-month cushion, at the model's burn."),
        bridge.facilities.total > 0 && (bridge.afterFacilities > 0
          ? h("div", null, "Less " + fmtMoney(bridge.facilities.total) + " of " + facilitiesPhrase(bridge.facilities) + (bridge.facilities.note ? " (" + bridge.facilities.note + ")" : "") + ": ", h("b", null, fmtMoney(bridge.afterFacilities)), " still to raise.")
          : h("div", null, "The " + fmtMoney(bridge.facilities.total) + " of " + facilitiesPhrase(bridge.facilities) + " entered would cover it, if they can be drawn when needed" + (bridge.facilities.note ? " (" + bridge.facilities.note + ")" : "") + ". Drawing an ATM still means selling shares at the market.")),
        bridge.shelfShort > 0 && h("div", { style: { color: "var(--warn)" } }, "Needs about " + fmtMoney(bridge.afterFacilities) + "; " + fmtMoney(bridge.facilities.shelf) + " remains on the shelf as entered — a new registration or a different structure would be needed."),
        bridge.afterFacilities > 0 && bridge.coveredByModelled && h("div", null,
          "This case already models a raise of " + fmtMoney(bridge.modelledAmount) + ", which would cover it (Assumptions → Future financing), so the valuation already pays for it."),
        bridge.afterFacilities > 0 && !bridge.coveredByModelled && bridge.newShares != null && h("div", null,
          "Raised at " + bridge.discountPct + "% below today's price ($" + bridge.raisePrice.toFixed(2) + "), that is about " + (bridge.newShares / 1e6).toFixed(1) + "M new shares" +
          (bridge.baseNow != null && bridge.baseWith != null ? "; Base fair value would be " + fmtShare(bridge.baseWith) + " with it" + (bridge.alreadyModelled ? " in place of the modelled " + fmtMoney(bridge.modelledAmount) + " raise" : "") + ", against " + fmtShare(bridge.baseNow) + " now" +
            (bridge.alreadyModelled ? "." : bridge.raisePrice > bridge.baseNow ? " — the shares would be sold above this case's own value per share, so the raise adds more than it dilutes." : " — the cost of selling shares below this case's own value per share.") : ".")),
        bridge.afterFacilities > 0 && bridge.newShares == null && h("div", { style: UI.caption }, "Set a current price on the case to size the raise in shares."),
        bridge.zeroDate != null && h("div", { style: UI.caption }, "With no raise at all, the modelled cash reaches zero about " + bridge.zeroDate.toFixed(0) + " months from today."),
        bridge.afterFacilities > 0 && !bridge.coveredByModelled && bridge.newShares != null && updateCase && h("div", { "data-no-export": "", style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 } },
          !confirmRaise
            ? h("button", { type: "button", onClick: () => { setConfirmRaise(true); setRaiseMsg(""); }, style: { padding: "6px 12px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" } }, "Model this raise")
            : h(React.Fragment, null,
                h("span", null, (bridge.alreadyModelled ? "Replace the case's modelled raise with " : "Add ") + fmtMoney(bridge.afterFacilities) + " at " + bridge.discountPct + "% below today's price? This changes the valuation."),
                h("button", { type: "button", onClick: () => { updateCase({ ...theCase, futureRaise: { ...(theCase.futureRaise || {}), ...bridge.raise }, updatedAt: Date.now() }); setConfirmRaise(false); setRaiseMsg("Added to the case: Assumptions → Future financing shows it."); },
                  style: { padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--teal-fill)", color: "var(--on-teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" } }, "Confirm"),
                h("button", { type: "button", onClick: () => setConfirmRaise(false), style: { padding: "6px 12px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Cancel"))),
        raiseMsg && h("div", { style: { color: "var(--teal)", marginTop: 6 } }, raiseMsg)),

      // Timeline: runway as a bar, catalysts as markers along the same axis.
      (() => {
        if (!res.rows.length) return null;
        const horizon = (res.beyondHorizon ? Math.max(...res.rows.map(r => r.monthsAway)) : Math.max(res.runwayMonths, ...res.rows.map(r => r.monthsAway))) * 1.15 || 12;
        const pct = m => Math.max(0, Math.min(100, (m / horizon) * 100));
        return h(ExportableBlock, { title: (theCase.name || "Case") + " — cash runway vs. catalysts", style: { marginTop: 18 } },
          h("div", { style: { ...UI.caption, marginBottom: 8 } }, "Timeline from today"),
          h("div", { style: { position: "relative", height: 26, borderRadius: 5, background: "var(--surface-2)", overflow: "hidden", marginBottom: 6 } },
            h("div", { title: res.beyondHorizon ? "Cash never runs out in the projection window" : "Modeled runway: " + res.runwayMonths.toFixed(1) + " months",
              style: { position: "absolute", left: 0, top: 0, bottom: 0, width: (res.beyondHorizon ? 100 : pct(res.runwayMonths)) + "%", background: "var(--teal)", opacity: 0.35 } }),
            !res.beyondHorizon && h("div", { style: { position: "absolute", left: pct(res.runwayMonths) + "%", top: 0, bottom: 0, width: 2, background: "var(--teal)" } })
          ),
          h("div", { style: { position: "relative", height: 8 + res.rows.length * 26 } },
            res.rows.map((r, i) => h("div", { key: i, style: { position: "absolute", top: i * 26, left: 0, right: 0, height: 22 } },
              // A window ("H1 2027") is drawn as its span, under the marker
              // at its end, clear of the label beside the marker.
              r.monthsToStart < r.monthsAway - 0.5 && h("div", { "aria-hidden": "true", title: r.dateText + ": " + Math.max(0, r.monthsToStart).toFixed(1) + "–" + r.monthsAway.toFixed(1) + " months out",
                style: { position: "absolute", left: pct(Math.max(0, r.monthsToStart)) + "%", width: Math.max(0.5, pct(r.monthsAway) - pct(Math.max(0, r.monthsToStart))) + "%", top: 19, height: 3, borderRadius: 2, background: STATUS[r.status].color, opacity: 0.45 } }),
              h("div", { title: r.label + " — " + r.dateText, style: { position: "absolute", left: pct(r.monthsAway) + "%", top: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" } },
                h("div", { style: { width: 2, height: 8, background: STATUS[r.status].color } }),
                h("div", { style: { width: 9, height: 9, borderRadius: "50%", background: STATUS[r.status].color, marginTop: -1 } })),
              // A catalyst in the right half puts its label to the left of its
              // marker; placed to the right it ran off the edge of the card.
              h("div", { style: Object.assign({ position: "absolute", top: 1, fontFamily: "var(--mono)", fontSize: 10, color: STATUS[r.status].color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
                  pct(r.monthsAway) > 50 ? { right: "calc(" + (100 - pct(r.monthsAway)) + "% + 10px)", maxWidth: "calc(" + pct(r.monthsAway) + "% - 10px)", textAlign: "right" }
                    : { left: "calc(" + pct(r.monthsAway) + "% + 10px)", maxWidth: "calc(" + (100 - pct(r.monthsAway)) + "% - 10px)" }) },
                r.label + " · " + r.dateText)
            ))
          ),
          h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 4 } },
            h("span", null, "today"), h("span", null, "+" + (horizon / 2).toFixed(0) + " mo"), h("span", null, "+" + horizon.toFixed(0) + " mo"))
        );
      })(),

      // Per-catalyst detail.
      res.rows.length > 0 && h("div", { style: { marginTop: 20, display: "flex", flexDirection: "column", gap: 7 } },
        res.rows.map((r, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "9px 12px", borderRadius: 7, background: "var(--surface-2)", borderLeft: "3px solid " + STATUS[r.status].color } },
          h("div", null,
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--ink-1)" } }, r.label),
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 } },
              r.programName, " · ", r.dateText, " · ",
              r.monthsToStart < r.monthsAway - 0.5 ? Math.max(0, r.monthsToStart).toFixed(1) + "–" + r.monthsAway.toFixed(1) + " mo out" : r.monthsAway.toFixed(1) + " mo out"),
            r.pin && h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--teal)", marginTop: 2 } },
              "Pinned · " + catalystPinLabel(r.pin) + (r.pin.source ? " · " + r.pin.source : ""))),
          h("div", { style: { textAlign: "right", flexShrink: 0 } },
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: STATUS[r.status].color } }, STATUS[r.status].word),
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 } },
              res.beyondHorizon ? "never runs out" : fmtMonths(r.cushionAtCatalyst) + " of cash " + (r.monthsToStart < r.monthsAway - 0.5 ? "at the window's end" : "at readout")))
        ))
      ),

      res.undatedCount > 0 && res.rows.length > 0 && h("div", { style: { marginTop: 12, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" } },
        res.undatedCount, " further prediction" + (res.undatedCount > 1 ? "s" : "") + " had no parseable date and " + (res.undatedCount > 1 ? "were" : "was") + " left out rather than guessed at."),
      res.pastCount > 0 && h("div", { style: { marginTop: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" } },
        res.pastCount + " pending prediction" + (res.pastCount > 1 ? "s are" : " is") + " dated in the past and left out — score " + (res.pastCount > 1 ? "them" : "it") + " on the Calibration tab."),

      h("div", { style: { marginTop: 14 } },
        h(Note, { summary: "What this runway figure doesn't know about" },
          h("div", { style: { lineHeight: 1.6 } },
            "It is the case's own modeled burn carried forward in nominal dollars. It does not know about an ATM already in place, an undrawn credit facility, or partnership milestone cash unless you enter them (Assumptions → Capital structure → Undrawn ATM, debt, milestones and shelf); then the runway “with facilities” appears beside it. Treat a gap as \"check how they intend to fund this\", not as a prediction that they won't.")))
    ]))
  );
}
