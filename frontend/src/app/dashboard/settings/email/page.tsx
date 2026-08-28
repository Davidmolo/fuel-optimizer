import { redirect } from "next/navigation";

export default function EmailSettingsRedirectPage() {
  redirect("/dashboard/settings/fuel-recommendations");
}
