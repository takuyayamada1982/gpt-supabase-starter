import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 依存なしの簡易抽出（必要なら Readability 等に後で差し替え可）
function extractMainText(html: string): string {
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const ogDesc =
    html.match(/<meta[^>]*property=['"]og:description['"][^>]*content=['"]([^'"]+)['"][^>]*>/i)?.[1] ||
    html.match(/<meta[^>]*name=['"]description['"][^>]*content=['"]([^'"]+)['"][^>]*>/i)?.[1] ||
    "";
  let text = html.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  const head = [title, ogDesc].filter(Boolean).join(" / ");
  const body = head ? `${head}\n\n${text}` : text;
  return body.slice(0, 8000);
}

export async function POST(req: NextRequest) {
  try {
    const { userId, url, promptContext } = await req.json();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; URL-Extractor/1.0)" },
      // @ts-ignore
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: `fetch failed: ${res.status}` }, { status: 502 });
    const html = await res.text();
    const content = extractMainText(html);
    if (!content) return NextResponse.json({ error: "content empty" }, { status: 422 });

    // 🔽 ここで要約/タイトル/ハッシュタグ + 各SNS文を一括JSON生成
    const system =
      "あなたは日本語のプロ編集者兼SNSコピーライターです。出力は必ず有効なJSONのみ。説明文や余計な文字は一切出力しないでください。";
    const userPrompt = `
以下の本文を要約し、タイトル候補・ハッシュタグ候補、さらにSNS向け原稿（Instagram/Facebook/X）を作成してください。
${promptContext ? `\n【前提】${promptContext}\n` : ''}
【本文（必要に応じて抜粋可）】
${content}

【要件】
- summary: 200〜300文字程度で要点を簡潔に日本語要約
- titles: 3案（短く魅力的に、全角30文字前後を目安）
- hashtags: 10〜15個（日本語/英語混在OK。#から始める。固有名詞は誤記に注意）
- instagram: 約200文字 + 文末に3〜6個のハッシュタグ
- facebook: ストーリー重視で約700文字、適度に改行 + 文末に3〜6個のハッシュタグ
- x: 約150文字、要点を端的に + 文末に2〜4個のハッシュタグ

【出力JSONスキーマ】
{
  "summary": "…200〜300文字…",
  "titles": ["…A…","…B…","…C…"],
  "hashtags": ["#tag1","#tag2", "..."],
  "instagram": "…本文＋ハッシュタグ…",
  "facebook": "…本文＋ハッシュタグ…",
  "x": "…本文＋ハッシュタグ…"
}
    `.trim();

    const ai = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      max_output_tokens: 1600,
      temperature: 0.6,
    });

    // usage ログ（ダッシュボード用）
    const usage: any = (ai as any).usage;
    if (usage) {
      await supabase.from("usage_logs").insert({
        user_id: userId,
        type: 'url',  // ★ ここを追加（URL用）
        model: (ai as any).model ?? "gpt-4.1-mini",
        prompt_tokens: usage.prompt_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? 0,
        total_tokens: usage.total_tokens ?? 0,
      });
    }

    const text = (ai as any).output_text ?? "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "invalid JSON from model", raw: text }, { status: 500 });
    }

    return NextResponse.json({
      summary: parsed.summary ?? "",
      titles: Array.isArray(parsed.titles) ? parsed.titles : [],
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      instagram: parsed.instagram ?? "",
      facebook: parsed.facebook ?? "",
      x: parsed.x ?? "",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
