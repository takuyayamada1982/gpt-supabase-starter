// app/api/video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';
import { toFile } from 'openai/uploads';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1動画あたりの原価（円）
const VIDEO_COST_YEN = 20;

// 今月の開始・終了を返すヘルパー
function getMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const start = new Date(year, month, 1).toISOString(); // 月初
  const end = new Date(year, month + 1, 1).toISOString(); // 翌月1日
  return { start, end };
}

export async function POST(req: NextRequest) {
  try {
    const { userId, prompt, filePath } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    }
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'filePath required' },
        { status: 400 }
      );
    }

    // 1) プロファイル取得（契約種別を確認）
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('plan_status, plan_tier')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.error('profile error:', profileErr);
      return NextResponse.json(
        { error: 'profile_error', message: 'プロフィールの取得に失敗しました。' },
        { status: 500 }
      );
    }

    const planStatus = profile?.plan_status ?? null; // 'trial' | 'paid' | null
    const planTier = profile?.plan_tier ?? null; // 'starter' | 'pro' | null

    // 2) プランごとの上限回数を決定
    let maxVideoCount: number | null = null; // null = そもそも利用不可

    if (planStatus === 'trial') {
      // トライアル → 動画は月5回まで
      maxVideoCount = 5;
    } else if (planStatus === 'paid' && planTier === 'pro') {
      // Proプラン → 月30回まで
      maxVideoCount = 30;
    } else {
      // Starter（画像のみ） or 未契約 → 動画機能は使えない
      return NextResponse.json(
        {
          error: 'plan_not_supported',
          message:
            'この動画文字起こし機能は Pro プラン専用です。スタータープランではご利用いただけません。',
          remaining: 0,
          planStatus,
          planTier,
        },
        { status: 403 }
      );
    }

    // 3) 今月の動画利用回数をカウント（usage_logs.type = 'video'）
    const { start, end } = getMonthRange();

    const { data: usedLogs, error: usedErr } = await supabase
      .from('usage_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'video')
      .gte('created_at', start)
      .lt('created_at', end);

    if (usedErr) {
      console.error('usage_logs count error:', usedErr);
      return NextResponse.json(
        {
          error: 'usage_count_error',
          message: '動画利用回数の取得に失敗しました。',
        },
        { status: 500 }
      );
    }

    const usedCount = usedLogs?.length ?? 0;
    const remainingBefore = Math.max(0, (maxVideoCount ?? 0) - usedCount);

    if (remainingBefore <= 0) {
      // 上限超え
      return NextResponse.json(
        {
          error: 'video_limit_exceeded',
          message:
            planStatus === 'trial'
              ? 'トライアルでの動画文字生成は 5 回までです。上限に達しました。'
              : '今月の動画文字生成の上限回数に達しています。',
          remaining: 0,
          planStatus,
          planTier,
        },
        { status: 400 }
      );
    }

    // 4) Supabase から動画ファイルを取得
    const { data: fileData, error: fileErr } = await supabase.storage
      .from('uploads') // 画像と同じバケットを想定
      .download(filePath);

    if (fileErr || !fileData) {
      console.error('Supabase download error:', fileErr);
      return NextResponse.json(
        {
          error: 'failed_to_download',
          message: '動画ファイルの取得に失敗しました。',
        },
        { status: 400 }
      );
    }

    // Blob → Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5) OpenAI Audio API で動画を文字起こし（gpt-4o-transcribe）
    //    toFile で buffer を OpenAI が期待する "file" 形式に変換
    const audioFile = await toFile(buffer, 'video.mp4', {
      type: 'video/mp4',
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'gpt-4o-transcribe',
      // gpt-4o-transcribe は response_format: 'json' 固定なので明示不要
      // language: 'ja', // 日本語メインなら指定してもOK
    });

    const transcriptText =
      (transcription as any).text ??
      JSON.stringify(transcription ?? {}, null, 2);

    // 6) Responses API で「SNS用の文章」に整形
    const userContent = [
      {
        type: 'input_text' as const,
        text:
          prompt +
          '\n\n---\n以下が動画の文字起こし結果です。この内容をもとに、SNS投稿にそのまま使える形で日本語の文章を作成してください。\n' +
          '・冗長な部分は整理\n' +
          '・重要なポイントは残す\n' +
          '・話し言葉を、読みやすい書き言葉に整える\n' +
          '・必要に応じて段落分け\n\n' +
          '【文字起こしテキスト】\n' +
          transcriptText,
      },
    ];

    const ai = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: userContent,
        },
      ],
      max_output_tokens: 1200,
      temperature: 0.6,
    });

    const usage: any = (ai as any).usage;

    // 7) usage_logs に video として記録（コスト20円）
    try {
      await supabase.from('usage_logs').insert({
        user_id: userId,
        model: (ai as any).model ?? 'gpt-4.1-mini',
        type: 'video',
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
        total_tokens: usage?.total_tokens ?? 0,
        cost: VIDEO_COST_YEN,
      });
    } catch (logErr) {
      console.error('usage_logs insert error (video):', logErr);
      // ここは致命的ではないので処理は続行
    }

    const text = (ai as any).output_text ?? '';

    // 8) 生成後に動画ファイルを削除（秘匿性担保）
    try {
      const { error: delError } = await supabase.storage
        .from('uploads')
        .remove([filePath]);
      if (delError) {
        console.error('failed to delete video file:', delError);
      }
    } catch (delEx) {
      console.error('exception on delete video file:', delEx);
    }

    // 9) 残り回数を 1 減らした値を返却
    const remainingAfter = Math.max(0, remainingBefore - 1);

    return NextResponse.json({
      text,
      remaining: remainingAfter,
      maxLimit: maxVideoCount,
      planStatus,
      planTier,
    });
  } catch (e: any) {
    console.error('API /api/video error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
