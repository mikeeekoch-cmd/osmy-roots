import { createRoot } from "react-dom/client";
import { RootsApp } from "../../src/ui";
import { rootsApi } from "../../src/app/roots-api";
const fixtureProjectId = new URLSearchParams(window.location.search).get("project") || undefined;
createRoot(document.getElementById("root")!).render(<>
  {fixtureProjectId && <aside style={{background:"#ffe7ae", padding:12}}>FICTIONAL API QA: test-prepared intake interpretation. Real HTTP persistence; no live model acceptance.</aside>}
  <RootsApp api={rootsApi} initialProjectId={fixtureProjectId} /></>,
);
