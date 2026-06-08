import { permanentRedirect } from "next/navigation";

export default function ChannelsNewRedirect() {
  permanentRedirect("/accounts/new");
}
