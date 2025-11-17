
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export async function POST(req: NextRequest){
  try{
    const { userId, userText } = await req.json();
    if(!userId) return NextResponse.json({error:'unauthorized'},{status:401});
    if(!userText) return NextResponse.json({error:'text required'},{status:400});
    const { data: setting } = await supabase.from('user_settings').select('system_prompt').eq('user_id', userId).maybeSingle();
    const systemPrompt = setting?.system_prompt || 'You are a helpful assistant.';
    const res = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [{role:'system',content:systemPrompt},{role:'user',content:userText}],
      max_output_tokens: 800, temperature: 0.7
    });
    const u: any = (res as any).usage;
    if(u){ await supabase.from('usage_logs').insert({
      user_id: userId,
      type: 'chat',  // ★ ここを追加（チャット用）
      model: (res as any).model ?? 'gpt-4.1-mini',
      prompt_tokens: u.prompt_tokens ?? 0, completion_tokens: u.completion_tokens ?? 0, total_tokens: u.total_tokens ?? 0
    }); }
    const text = (res as any).output_text ?? '';
    return NextResponse.json({ text });
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}
