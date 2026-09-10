import { createRoot } from "react-dom/client";
import { RootsApp } from "../../src/ui";
import { makeReplayApi } from "./replay-api";
const api = makeReplayApi();
createRoot(document.getElementById("root")!).render(
  <RootsApp api={api} mode="replay" />,
);
