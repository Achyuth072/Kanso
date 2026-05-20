import packageJson from "../../package.json";
import { SettingsClient } from "@/components/settings/SettingsClient";

const { version } = packageJson;

// Performance: Root settings page is now a Server Component (PERF-01).
export default function SettingsPage() {
  return <SettingsClient version={version} />;
}
