
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
type Row={user_id:string,total_tokens:number,calls:number};
export default function AdminPage(){
 const [rows,setRows]=useState<Row[]>([]);
 useEffect(()=>{(async()=>{
  const { data: logs } = await supabase.from('usage_logs').select('user_id,total_tokens');
  const map=new Map<string,{total_tokens:number,calls:number}>();
  (logs||[]).forEach((l:any)=>{ const m=map.get(l.user_id)||{total_tokens:0,calls:0}; m.total_tokens+=l.total_tokens; m.calls+=1; map.set(l.user_id,m); });
  const arr=Array.from(map.entries()).map(([user_id,v])=>({user_id,...v})); setRows(arr);
 })();},[]);
 return(<main className="space-y-4">
  <h2 className="text-lg font-semibold">管理ダッシュボード（簡易）</h2>
  <table className="w-full border bg-white"><thead><tr className="bg-gray-50">
    <th className="border p-2 text-left">user_id</th><th className="border p-2 text-right">合計トークン</th><th className="border p-2 text-right">リクエスト数</th>
  </tr></thead><tbody>
    {rows.map((r,i)=>(<tr key={i}><td className="border p-2">{r.user_id}</td><td className="border p-2 text-right">{r.total_tokens}</td><td className="border p-2 text-right">{r.calls}</td></tr>))}
  </tbody></table>
 </main>);}
