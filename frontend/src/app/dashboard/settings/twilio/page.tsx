import { redirect } from "next/navigation";

export default function TwilioSettingsRedirectPage() {
  redirect("/dashboard/settings/profile");
}
