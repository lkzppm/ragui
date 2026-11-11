import type { Metadata } from "next";
import { Lab } from "@/components/lab/lab";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Lab · ${BRAND.name}` };

/** One dataset, open. The id is a preset's, or one kept in the visitor's browser: only the browser can tell. */
export default async function DatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Lab id={id} />;
}
