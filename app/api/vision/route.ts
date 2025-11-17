import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// service_role を使う（この API はサーバー側のみで実行される）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 👇 ここで filePath / prompt / userId を受け取る
    const { userId, prompt, filePath } = await req.json();
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!filePath) return NextResponse.json({ error: "filePath required" }, { status: 400 });

    // 画像の署名URLを発行（TTL 300秒）
    const { data, error } = await supabase.storage
      .from("uploads")
      .createSignedUrl(filePath, 300);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || "failed to create signed url" }, { status: 500 });
    }

    const signedUrl = data.signedUrl;

    // OpenAI Responses API（テキスト＋画像のマルチモーダル）
    const system =
      "あなたはSNS向けコピー作成に長けた日本語アシスタントです。指示に従って簡潔に日本語で出力してください。";

    const ai = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt || "この画像の内容を日本語で簡潔に説明してください。" },
            // 👇 detail が必須になったため明示
            { type: "input_image", image_url: signedUrl, detail: "high" as any },
          ],
        },
      ],
      max_output_tokens: 600,
      temperature: 0.6,
    });

    const text = (ai as any).output_text ?? "";

    // 使用量をログ（管理ダッシュボード用）
    const usage: any = (ai as any).usage;
    if (usage) {
      await supabase.from("usage_logs").insert({
        user_id: userId,
        type: 'vision',  // ★ ここを追加（画像用）
        model: (ai as any).model ?? "gpt-4.1-mini",
        prompt_tokens: usage.prompt_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? 0,
        total_tokens: usage.total_tokens ?? 0,
      });
    }

    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
