
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
type Msg={role:'user'|'assistant',content:string};
export default function UPage(){
 const [userId,setUserId]=useState(''); const [systemPrompt,setSystemPrompt]=useState('');
 const [input,setInput]=useState(''); const [imageFile,setImageFile]=useState<File|null>(null);
 const [messages,setMessages]=useState<Msg[]>([]); const [loading,setLoading]=useState(false);
 useEffect(()=>{ supabase.auth.getUser().then(async({data})=>{ const uid=data.user?.id||''; setUserId(uid); if(!uid)return;
  const {data:rows}=await supabase.from('user_settings').select('*').eq('user_id',uid).maybeSingle();
  if(rows?.system_prompt) setSystemPrompt(rows.system_prompt); else{ await supabase.from('user_settings').upsert({user_id:uid,system_prompt:'あなたは親切なアシスタントです。'}); setSystemPrompt('あなたは親切なアシスタントです。'); }
 }); },[]);
 const sendText=async()=>{ if(!userId||!input)return; setLoading(true); setMessages(m=>[...m,{role:'user',content:input}]);
  const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,userText:input})});
  const j=await res.json(); setMessages(m=>[...m,{role:'assistant',content:j.text||''}]); setInput(''); setLoading(false); };
 const sendVision=async()=>{ if(!userId||!imageFile)return; setLoading(true);
  const path=`${userId}/${Date.now()}_${imageFile.name}`;
  const { error } = await supabase.storage.from('uploads').upload(path,imageFile,{upsert:true});
  if(error){ alert(error.message); setLoading(false); return; }
  const res=await fetch('/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,prompt:input,filePath:path})});
  const j=await res.json(); setMessages(m=>[...m,{role:'assistant',content:j.text||''}]); setInput(''); setImageFile(null); setLoading(false); };
 return(<main className="space-y-4">
  <h2 className="text-lg font-semibold">ユーザーページ</h2>
  <div className="border p-3 bg-white">
    <label className="block text-sm text-gray-600">固定プロンプト（system）</label>
    <textarea className="border p-2 w-full" rows={3} value={systemPrompt} onChange={e=>setSystemPrompt(e.target.value)}/>
    <button className="mt-2 px-3 py-2 border" onClick={async()=>{ if(!userId)return; await supabase.from('user_settings').upsert({user_id:userId,system_prompt:systemPrompt}); alert('保存しました');}}>保存</button>
  </div>
  <div className="border p-3 bg-white space-y-2">
    <div className="flex gap-2">
      <input className="border p-2 flex-1" placeholder="メッセージ or 画像の説明" value={input} onChange={e=>setInput(e.target.value)}/>
      <button className="px-3 py-2 bg-black text-white" disabled={loading} onClick={sendText}>送信</button>
    </div>
    <div className="flex items-center gap-2">
      <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0]||null)}/>
      <button className="px-3 py-2 border" disabled={!imageFile||loading} onClick={sendVision}>画像で送る</button>
    </div>
  </div>
  <div className="space-y-2">{messages.map((m,i)=>(<div key={i} className={`p-2 rounded ${m.role==='user'?'bg-blue-50':'bg-gray-100'}`}><div className="text-xs text-gray-500">{m.role}</div><div>{m.content}</div></div>))}</div>
 </main>);}
