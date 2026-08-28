import { redirect } from "next/navigation";

export default function LegacyEmailConfigRedirectPage() {
  redirect("/dashboard/settings/email");
}
