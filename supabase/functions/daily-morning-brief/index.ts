/**
 * Supabase Edge Function: daily-morning-brief
 *
 * Schedule: 0 1 * * *  →  7:00 AM IST (01:30 UTC)
 *
 * Logic:
 *   1. Fetch all active tenants
 *   2. For each tenant, fetch admin users opted-in to morning brief
 *   3. Call backend API: POST /admin/reports/morning-brief for each recipient
 *   4. Log success/failure to audit_log
 *
 * Environment variables (set in Supabase dashboard → Edge Functions → Secrets):
 *   BACKEND_API_URL     — https://your-railway-app.railway.app
 *   BACKEND_SERVICE_KEY — strong random key matching backend BACKEND_SERVICE_KEY
 *   SUPABASE_URL        — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BACKEND_API_URL = Deno.env.get("BACKEND_API_URL") ?? "";
const BACKEND_SERVICE_KEY = Deno.env.get("BACKEND_SERVICE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// SendGrid free tier: 100 emails/day — add safety margin
const MAX_EMAILS_PER_RUN = 90;

interface Tenant {
  id: string;
  name: string;
  is_active: boolean;
}

interface UserProfile {
  id: string;
  tenant_id: string;
  role: string;
  display_name: string | null;
  preferences: Record<string, unknown> | null;
}

interface AuthUser {
  id: string;
  email: string;
}

interface BriefResult {
  success: boolean;
  message: string;
  insights_count?: number;
  recipient_email?: string;
}

Deno.serve(async (_req: Request) => {
  const runStart = new Date();
  const results: Array<{
    tenant_id: string;
    email: string;
    success: boolean;
    message: string;
  }> = [];

  let emailsSent = 0;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ---- 1. Fetch all active tenants ----
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, name, is_active")
      .eq("is_active", true);

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    console.log(`Processing ${tenants?.length ?? 0} active tenants`);

    for (const tenant of (tenants as Tenant[]) ?? []) {
      if (emailsSent >= MAX_EMAILS_PER_RUN) {
        console.warn(`Email quota reached (${MAX_EMAILS_PER_RUN}), stopping`);
        break;
      }

      // ---- 2. Fetch opted-in admin profiles for this tenant ----
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, tenant_id, role, display_name, preferences")
        .eq("tenant_id", tenant.id)
        .eq("role", "admin");

      if (profilesError) {
        console.error(`Failed to fetch profiles for tenant ${tenant.id}: ${profilesError.message}`);
        continue;
      }

      const adminProfiles = (profiles as UserProfile[]) ?? [];

      for (const profile of adminProfiles) {
        if (emailsSent >= MAX_EMAILS_PER_RUN) break;

        // Check opt-in preference (defaults to true if not set)
        const prefs = profile.preferences ?? {};
        const opted_in = prefs["morning_brief_enabled"] !== false;
        if (!opted_in) {
          console.log(`User ${profile.id} has opted out of morning brief`);
          continue;
        }

        // Get email from Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin
          .getUserById(profile.id);

        if (authError || !authUser?.user?.email) {
          console.error(`Failed to get email for user ${profile.id}`);
          continue;
        }

        const recipientEmail = authUser.user.email;

        // ---- 3. Call backend API ----
        try {
          const response = await fetch(
            `${BACKEND_API_URL}/admin/reports/morning-brief`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Service-Key": BACKEND_SERVICE_KEY,
              },
              body: JSON.stringify({
                tenant_id: tenant.id,
                recipient_email: recipientEmail,
                recipient_name: profile.display_name ?? "",
                tenant_name: tenant.name,
              }),
              signal: AbortSignal.timeout(30_000), // 30s timeout per request
            }
          );

          const result: BriefResult = await response.json();
          emailsSent++;

          results.push({
            tenant_id: tenant.id,
            email: recipientEmail,
            success: result.success,
            message: result.message,
          });

          if (!result.success) {
            console.error(
              `Brief failed for ${recipientEmail} (tenant ${tenant.id}): ${result.message}`
            );
          } else {
            console.log(
              `Brief sent to ${recipientEmail} (tenant ${tenant.id}) — ${result.insights_count} insights`
            );
          }
        } catch (fetchError) {
          const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
          console.error(`Backend call failed for ${recipientEmail}: ${errMsg}`);
          results.push({
            tenant_id: tenant.id,
            email: recipientEmail,
            success: false,
            message: errMsg,
          });
        }

        // Small delay between sends to avoid rate-limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // ---- 4. Log execution to audit_log ----
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    await supabase.from("audit_log").insert({
      action: "morning_brief_run",
      resource_type: "email",
      details: {
        run_at: runStart.toISOString(),
        emails_sent: successCount,
        emails_failed: failCount,
        total_tenants: tenants?.length ?? 0,
        results: results.slice(0, 50), // cap to avoid large payloads
      },
    });

    const summary = {
      run_at: runStart.toISOString(),
      emails_sent: successCount,
      emails_failed: failCount,
      total_tenants: tenants?.length ?? 0,
    };

    console.log("Morning brief run complete:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Morning brief run failed:", errMsg);

    return new Response(
      JSON.stringify({ error: errMsg, run_at: runStart.toISOString() }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
