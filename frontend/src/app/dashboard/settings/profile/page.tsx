import { redirect } from "next/navigation";

export default function ProfileSettingsRedirectPage() {
  redirect("/dashboard/settings/fuel-recommendations");
}
