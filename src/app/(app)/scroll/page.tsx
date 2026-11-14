import { requireContext } from "@/lib/session";
import { ScrollClient } from "./ScrollClient";

export default async function ScrollPage() {
  await requireContext();
  return <ScrollClient />;
}
