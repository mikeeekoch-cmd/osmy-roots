"use client";
import { RootsApp } from "../ui";
import { rootsApi } from "./roots-api";
export default function Page() {
  return <RootsApp api={rootsApi} />;
}
