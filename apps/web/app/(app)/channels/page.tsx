import { permanentRedirect } from "next/navigation";

// Back-compat: /channels is now /accounts.
export default function ChannelsRedirect() {
  permanentRedirect("/accounts");
}
