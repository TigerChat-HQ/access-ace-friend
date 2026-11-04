import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Code2, Sparkles, GitPullRequest, ShieldCheck } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Task={id:string;title:string;status:string;risk:string};
export function TigerDeveloperEditor({tasks,onChanged}:{tasks:Task[];onChanged:()=>Promise<void>}) {
 const [files,setFiles]=useState<string[]>([]),[path,setPath]=useState(''),[taskId,setTaskId]=useState('');
 const [original,setOriginal]=useState(''),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [proposal,setProposal]=useState<Tables<'dev_code_proposals'>|null>(null);
 const [history,setHistory]=useState<Tables<'dev_code_proposals'>[]>([]);
 const approved=tasks.filter(t=>['approved','in_progress'].includes(t.status));
 async function call(body:Record<string,unknown>) {const {data,error}=await supabase.functions.invoke('tiger-dev-editor',{body});if(error)throw new Error(error instanceof FunctionsHttpError?await error.context.text():error.message);if(data?.error)throw new Error(data.error);return data;}
 async function run(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Editor failed');}finally{setBusy(false);}}
 async function loadHistory(){const {data}=await supabase.from('dev_code_proposals').select('*').order('created_at',{ascending:false}).limit(20);setHistory(data||[]);}
 useEffect(()=>{void run(async()=>{const r=await call({action:'files'});setFiles(r.files);await loadHistory();});},[]);
 async function propose(ai:boolean){await run(async()=>{const r=await call({action:'propose',task_id:taskId,path,...(!ai?{content:draft}:{})});setProposal(r.proposal);setDraft(r.proposal.proposed);await loadHistory();await onChanged();});}
 const security=proposal?.security as {allowed?:boolean;findings?:string[]}|undefined;
 return <div className="space-y-4">
 <h3 className="flex items-center gap-2 font-medium"><Code2 className="h-4 w-4 text-primary"/>Tiger AI Developer Editor</h3>
 <p className="text-xs text-muted-foreground">TigerChat-HQ/access-ace-friend · Autonomous commit, CI-gated merge, deployment check, and full audit enabled</p>
 <label className="block text-sm">Approved task<select aria-label="Approved task" className="mt-1 w-full rounded-md border border-input bg-background p-2" value={taskId} onChange={e=>{setTaskId(e.target.value);setProposal(null);}}><option value="">Choose task</option>{approved.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
 <div className="flex gap-2"><select aria-label="Source file" className="min-w-0 flex-1 rounded-md border border-input bg-background p-2 text-sm" value={path} onChange={e=>{setPath(e.target.value);setProposal(null);setOriginal('');setDraft('');}}><option value="">Choose authorized file</option>{files.map(f=><option key={f}>{f}</option>)}</select><Button disabled={busy||!path} onClick={()=>void run(async()=>{const r=await call({action:'read',path});setOriginal(r.content);setDraft(r.content);setProposal(null);await onChanged();})}>Open file</Button></div>
 {original && <><div className="grid gap-3 lg:grid-cols-2"><div><h4 className="mb-1 text-xs">Original</h4><pre className="h-80 overflow-auto rounded-md border border-border bg-surface p-3 text-xs">{original}</pre></div><div><h4 className="mb-1 text-xs">Proposed code</h4><Textarea aria-label="Proposed code" className="h-80 font-mono text-xs" value={draft} onChange={e=>{setDraft(e.target.value);setProposal(null);}} /></div></div>
 <div className="flex flex-wrap gap-2"><Button disabled={busy||!taskId} onClick={()=>void propose(true)}><Sparkles className="mr-2 h-4 w-4"/>Suggest fix</Button><Button variant="outline" disabled={busy||!taskId||draft===original} onClick={()=>void propose(false)}><ShieldCheck className="mr-2 h-4 w-4"/>Check and save proposal</Button></div></>}
 {proposal && <div className="space-y-2 border-t border-border pt-3"><p className="text-sm">{proposal.summary}</p><p className="text-xs text-muted-foreground">Static safety screening: {security?.allowed?'passed':'blocked'}. Applying will commit to a Tiger branch, wait for CI, merge to <code>main</code>, and monitor the configured deployment workflow.</p>{security?.findings?.map(f=><p className="text-xs text-destructive" key={f}>{f}</p>)}<Button disabled={busy||!security?.allowed||proposal.status!=='proposed'||tasks.find(t=>t.id===proposal.task_id)?.risk==='high'} onClick={()=>{if(!confirm('Run the autonomous pipeline? Tiger AI will commit, wait for CI, merge to main, trigger deployment, and audit every step.'))return;void run(async()=>{await call({action:'apply',proposal_id:proposal.id});setProposal(null);await loadHistory();await onChanged();});}}><GitPullRequest className="mr-2 h-4 w-4"/>Run autonomous commit and deploy</Button></div>}
 {busy&&<p role="status" className="text-xs text-muted-foreground">Working…</p>}{error&&<p role="alert" className="break-words text-sm text-destructive">{error}</p>}
 <h4 className="text-sm font-medium">Code modification history</h4>{history.map(p=><div key={p.id} className="border-b border-border py-2 text-xs"><p>{p.path} · {p.status}</p>{p.pr_url&&<a className="text-primary underline" href={p.pr_url} target="_blank" rel="noreferrer">Review proposed changes on GitHub</a>}</div>)}
 </div>;
}
