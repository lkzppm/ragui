import type { Metadata } from "next";
import { Lab } from "@/components/lab/lab";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Lab · ${BRAND.name}` };

export default function LabPage() {
  return <Lab />;
}
