
'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
export default function LoginPage(){
 const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
 const [mode,setMode]=useState<'signin'|'signup'>('signin'); const [err,setErr]=useState<string|null>(null);
 const router=useRouter();
 const submit=async()=>{ setErr(null);
  try{ if(mode==='signup'){ const {error}=await supabase.auth.signUp({email,password}); if(error) throw error;
    alert('確認メールを送信しました。メール内のリンクを踏んでからログインしてください。');
  }else{ const {data,error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error; if(data?.user) router.push('/u'); }
  }catch(e:any){ setErr(e.message); } };
 return(<main className="space-y-4"><h2 className="text-lg font-semibold">{mode==='signin'?'ログイン':'新規登録'}</h2>
   <div className="space-y-2">
     <input className="border p-2 w-full" placeholder="メールアドレス" value={email} onChange={e=>setEmail(e.target.value)}/>
     <input className="border p-2 w-full" placeholder="パスワード" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
     {err&&<p className="text-red-600 text-sm">{err}</p>}
     <button className="px-4 py-2 bg-black text-white" onClick={submit}>{mode==='signin'?'ログイン':'登録'}</button>
     <button className="px-3 py-2 border ml-2" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'→ 新規登録':'→ ログインに戻る'}</button>
   </div></main>);}
