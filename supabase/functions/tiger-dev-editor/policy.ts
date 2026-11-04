const ALLOWED_PATH = /^(src\/(pages|components|hooks|lib|data|types)\/[a-zA-Z0-9_./-]+\.(tsx?|css|json)|supabase\/migrations\/[a-zA-Z0-9_.-]+\.sql)$/;
const PROTECTED_PATH = /(auth|permission|role|supabase\/functions|integrations|generated|webRTC|CallContext|\.env|workflow|package-lock|bun\.lock|drizzle\/)/i;
const DANGEROUS_CONTENT = /(service_role|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|BEGIN.*PRIVATE KEY|eval\s*\(|new Function\s*\(|dangerouslySetInnerHTML|document\.cookie|localStorage.*token|createClient\([^)]*SERVICE_ROLE|disable.*audit|drop\s+policy|alter\s+table.*disable\s+row level security)/is;

export function checkCode(path: string, content: string) {
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
