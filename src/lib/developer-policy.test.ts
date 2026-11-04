import { expect,it } from 'vitest';
import { checkCode } from '../../supabase/functions/tiger-dev-editor/policy';
it('permits source changes to an approved page scope',()=>expect(checkCode('src/pages/Draughts.tsx','export const value=1').allowed).toBe(true));
it('blocks authentication and credential modifications',()=>{expect(checkCode('src/pages/Auth.tsx','safe').allowed).toBe(false);expect(checkCode('src/pages/Feed.tsx','SUPABASE_SERVICE_ROLE_KEY').allowed).toBe(false);});
it('blocks traversal and executable injection',()=>{expect(checkCode('src/lib/../../secret.ts','safe').allowed).toBe(false);expect(checkCode('src/lib/helper.ts','eval(input)').allowed).toBe(false);});
