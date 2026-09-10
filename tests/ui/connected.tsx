import { createRoot } from "react-dom/client";
import { RootsApp } from "../../src/ui";
import { rootsApi } from "../../src/app/roots-api";
createRoot(document.getElementById("root")!).render(
  <RootsApp api={rootsApi} />,
);
