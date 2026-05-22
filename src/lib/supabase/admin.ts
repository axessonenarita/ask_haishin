import { createClient } from "@supabase/supabase-js";

function decodeJwtRole(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const padded =
      parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4);
    const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    const json = JSON.parse(decoded) as Record<string, unknown>;
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  const role = decodeJwtRole(serviceKey);
  if (role && role !== "service_role") {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY appears to be a "${role}" key, not service_role. ` +
        `Use the service_role secret from Supabase Project Settings → API.`,
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
