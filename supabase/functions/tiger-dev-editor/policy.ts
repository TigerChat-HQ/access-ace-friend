export function checkCode(path: string, content: string) {
 const blockedPath = !/^src\/(pages|components|hooks|lib)\/[a-zA-Z0-9_./-]+\.(tsx?|css)$/.test(path) || path.includes('..') || /(auth|permission|role|supabase|integrations|generated|webRTC|CallContext)/i.test(path);
 const findings: string[] = [];
 if (blockedPath) findings.push('Protected or unsupported file path');
 if (/(service_role|SERVICE_ROLE_KEY|BEGIN.*PRIVATE KEY|eval\s*\(|new Function\s*\(|dangerouslySetInnerHTML|document\.cookie|localStorage.*token)/i.test(content)) findings.push('Sensitive credential, execution or unsafe markup pattern');
 return { allowed: findings.length === 0, findings, scope: 'Static safety screening only; tests and human review are still required.' };
}
