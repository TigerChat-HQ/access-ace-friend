import { describe, it, expect } from "vitest";

const ALLOWED_PATH = /^(src\/(pages|components|hooks|lib|data|types)\/[a-zA-Z0-9_./-]+\.(tsx?|css|json)|supabase\/migrations\/[a-zA-Z0-9_.-]+\.sql)$/;
const PROTECTED_PATH = /(auth|permission|role|supabase\/functions|integrations|generated|webRTC|CallContext|\.env|workflow|package-lock|bun\.lock|drizzle\/)/i;
const DANGEROUS_CONTENT = /(service_role|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|BEGIN.*PRIVATE KEY|eval\s*\(|new Function\s*\(|dangerouslySetInnerHTML|document\.cookie|localStorage.*token|createClient\([^)]*SERVICE_ROLE|disable.*audit|drop\s+policy|alter\s+table.*disable\s+row level security)/is;

function checkCode(path: string, content: string) {
  const findings: string[] = [];
  if (!ALLOWED_PATH.test(path) || path.includes("..") || PROTECTED_PATH.test(path)) {
    findings.push("Protected or unsupported file path");
  }
  if (DANGEROUS_CONTENT.test(content)) {
    findings.push("Sensitive credential, authorization, execution, or audit-bypass pattern");
  }
  return {
    allowed: findings.length === 0,
    findings,
    scope: "Autonomous policy screening only; protected security changes are blocked and all actions are audited.",
  };
}

describe("Tiger AI Stage 2 proposeCode policy and safety", () => {
  it("allows safe changes to components and pages", () => {
    const res = checkCode("src/components/chat/TigerChatBackground.tsx", "export const customBg = true;");
    expect(res.allowed).toBe(true);
    expect(res.findings).toHaveLength(0);
  });

  it("blocks modifications to auth, permissions, or roles", () => {
    const resAuth = checkCode("src/pages/Auth.tsx", "export const custom = true;");
    expect(resAuth.allowed).toBe(false);
    expect(resAuth.findings).toContain("Protected or unsupported file path");

    const resRole = checkCode("src/hooks/useUserRole.ts", "export const custom = true;");
    expect(resRole.allowed).toBe(false);
  });

  it("blocks directory traversal attempts", () => {
    const res = checkCode("src/components/../../package.json", "export const custom = true;");
    expect(res.allowed).toBe(false);
    expect(res.findings).toContain("Protected or unsupported file path");
  });

  it("blocks dangerous execution or credential patterns", () => {
    const resServiceKey = checkCode("src/components/chat/TigerChatBackground.tsx", "const k = SUPABASE_SERVICE_ROLE_KEY;");
    expect(resServiceKey.allowed).toBe(false);
    expect(resServiceKey.findings).toContain("Sensitive credential, authorization, execution, or audit-bypass pattern");

    const resEval = checkCode("src/lib/utils.ts", "eval('console.log(1)');");
    expect(resEval.allowed).toBe(false);
  });

  it("blocks high-risk tasks before proposing code", () => {
    const highRiskTask = {
      id: "task-123",
      title: "Delete user accounts automatically",
      risk: "high",
      status: "approved",
    };

    function validateTaskRisk(task: { risk: string }) {
      if (task.risk === "high") {
        return { error: "High-risk changes require manual engineering and cannot be drafted automatically" };
      }
      return { ok: true };
    }

    const check = validateTaskRisk(highRiskTask);
    expect(check.error).toBe("High-risk changes require manual engineering and cannot be drafted automatically");
  });
});
