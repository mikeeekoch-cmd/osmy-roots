"use client";
import { useParams } from "next/navigation";
import { RootsApp } from "../../../ui";
import { rootsApi } from "../../roots-api";
export default function SavedProjectPage() {
  const { id } = useParams<{ id: string }>();
  return <RootsApp api={rootsApi} initialProjectId={id} />;
}
