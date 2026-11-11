import type { Metadata } from "next";
import { Explorer } from "@/components/lab/explorer";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Lab · ${BRAND.name}` };

export default function LabPage() {
  return <Explorer />;
}
