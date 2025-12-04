// app/api/version/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 画像生成の原価（円）
const IMAGE_COST_YEN = 1;
// 動画サムネ＋文字生成の原価（円）
const VIDEO_COST_YEN = 20;

// 今月の開始・終了を返すヘルパー（Pro動画用）
function getMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const start = new Date(year, month, 1).toISOString(); // 月初
  const end = new Date(year, month + 1, 1).toISOString(); // 翌月1日
  return { start, end };
}

type VisionMode = 'image' | 'video_thumb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId as string | undefined;
    const userEmail = body.userEmail as string | undefined;
    const prompt = body.prompt as string | undefined;
    const filePath = body.filePath as string | undefined;
    const mode: VisionMode =
      body.mode === 'video_thumb' ? 'video_thumb' : 'image';

    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    }
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'filePath required' },
        { status: 400 },
      );
    }

    // 1) プロファイル取得（動画サムネ利用可否・Trial期間起点用）
    let profile: any = null;
    let profileErr: any = null;

    if (userEmail) {
      const { data, error } = await supabase
        .from('profiles')
        .select('plan_status, plan_tier, registered_at')
        .eq('email', userEmail)
        .maybeSingle();
      profile = data;
      profileErr = error;
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select('plan_status, plan_tier, registered_at')
        .eq('id', userId)
        .maybeSingle();
      profile = data;
      profileErr = error;
    }

    if (profileErr) {
      console.error('profile error (version):', profileErr);
      return NextResponse.json(
        {
          error: 'profile_error',
          message: 'プロフィールの取得に失敗しました。',
        },
        { status: 500 },
      );
    }

    const planStatus = profile?.plan_status as
      | 'trial'
      | 'paid'
      | null
      | undefined;
    const planTier = profile?.plan_tier as
      | 'starter'
      | 'pro'
      | null
      | undefined;

    // 2) 動画サムネ利用時のみ、プランチェック & 回数制限
    if (mode === 'video_thumb') {
      // Trial / Pro 以外は利用不可
      const canUseVideo =
        planStatus === 'trial' ||
        (planStatus === 'paid' && planTier === 'pro');

      if (!canUseVideo) {
        if (planStatus === 'paid' && planTier === 'starter') {
          return NextResponse.json(
            {
              error: 'plan_not_supported',
              message:
                '「動画からサムネを作って3種類の原稿を作る」機能は Starter プランではご利用いただけません。トライアル期間中または Pro プランでご利用いただけます。',
            },
            { status: 403 },
          );
        }
        return NextResponse.json(
          {
            error: 'plan_not_supported',
            message:
              '「動画からサムネを作って3種類の原稿を作る」機能は、トライアル期間中または Pro プランでご利用いただけます。',
          },
          { status: 403 },
        );
      }

      // Trial中: 期間中合計10回まで
      // Pro: 1ヶ月30回まで
      let maxVideoCount = 0;
      let usedFrom = '';
      let usedTo = '';

      if (planStatus === 'trial') {
        maxVideoCount = 10;
        const reg = profile?.registered_at
          ? new Date(profile.registered_at)
          : null;
        usedFrom = reg ? reg.toISOString() : new Date(2000, 0, 1).toISOString();
        usedTo = new Date().toISOString();
      } else if (planStatus === 'paid' && planTier === 'pro') {
        maxVideoCount = 30;
        const { start, end } = getMonthRange();
        usedFrom = start;
        usedTo = end;
      }

      const { data: usedLogs, error: usedErr } = await supabase
        .from('usage_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'video')
        .gte('created_at', usedFrom)
        .lt('created_at', usedTo);

      if (usedErr) {
        console.error('usage_logs count error (video):', usedErr);
        return NextResponse.json(
          {
            error: 'usage_count_error',
            message: '動画サムネ機能の利用回数の取得に失敗しました。',
          },
          { status: 500 },
        );
      }

      const usedCount = usedLogs?.length ?? 0;
      const remainingBefore = Math.max(0, maxVideoCount - usedCount);

      if (remainingBefore <= 0) {
        const msg =
          planStatus === 'trial'
            ? 'トライアル期間中の「動画からサムネ＋文字生成」は 10 回までです。上限に達しました。'
            : '今月の「動画からサムネ＋文字生成」の上限回数（30回）に達しています。';
        return NextResponse.json(
          {
            error: 'video_limit_exceeded',
            message: msg,
            remaining: 0,
            planStatus,
            planTier,
          },
          { status: 400 },
        );
      }
    }

    // 3) Supabase Storage 上の画像の public URL を取得
    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData?.publicUrl;
    if (!imageUrl) {
      return NextResponse.json(
        {
          error: 'no_public_url',
          message: '画像ファイルのURLが取得できませんでした。',
        },
        { status: 400 },
      );
    }

    // 4) OpenAI に投げるコンテンツを準備
    const extraNoteForVideo =
      mode === 'video_thumb'
        ? '（この画像は動画から切り出した1枚のサムネイルです。動画全体の雰囲気やストーリーが伝わるように文章を整えてください。）'
        : '';

    const finalPrompt =
      'あなたはSNS向けの日本語コピーを作るプロの編集者です。' +
      '指定されたルールに従い、画像の内容を踏まえてSNS投稿文を1つ生成してください。' +
      '\n\n' +
      prompt +
      extraNoteForVideo;

    const userContent: any[] = [
      {
        type: 'input_text',
        text: finalPrompt,
      },
      {
        type: 'input_image',
        image_url: imageUrl,
        detail: 'low',
      },
    ];

    // 5) OpenAI Responses API で生成
    const ai: any = await (openai as any).responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: userContent,
        },
      ],
      max_output_tokens: 1200,
      temperature: 0.7,
    });

    const usage = ai.usage;
    const text: string = ai.output_text ?? '';

    // 6) usage_logs に記録
    const typeForLog = mode === 'video_thumb' ? 'video' : 'vision';
    const costForLog = mode === 'video_thumb' ? VIDEO_COST_YEN : IMAGE_COST_YEN;

    try {
      await supabase.from('usage_logs').insert({
        user_id: userId,
        model: ai.model ?? 'gpt-4.1-mini',
        type: typeForLog,
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
        total_tokens: usage?.total_tokens ?? 0,
        cost: costForLog,
      });
    } catch (logErr) {
      console.error('usage_logs insert error (version):', logErr);
      // ログ保存失敗は致命的ではないので継続
    }

    // 7) 画像ファイルは生成後に削除
    try {
      const { error: delError } = await supabase.storage
        .from('uploads')
        .remove([filePath]);
      if (delError) {
        console.error('failed to delete image file:', delError);
      }
    } catch (delEx) {
      console.error('exception on delete image file:', delEx);
    }

    // 8) 動画モードのときだけ、残り回数も返却
    if (mode === 'video_thumb') {
      let maxVideoCount = 0;
      let usedFrom = '';
      let usedTo = '';

      if (planStatus === 'trial') {
        maxVideoCount = 10;
        const reg = profile?.registered_at
          ? new Date(profile.registered_at)
          : null;
        usedFrom = reg ? reg.toISOString() : new Date(2000, 0, 1).toISOString();
        usedTo = new Date().toISOString();
      } else if (planStatus === 'paid' && planTier === 'pro') {
        maxVideoCount = 30;
        const { start, end } = getMonthRange();
        usedFrom = start;
        usedTo = end;
      }

      const { data: usedLogs2 } = await supabase
        .from('usage_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'video')
        .gte('created_at', usedFrom)
        .lt('created_at', usedTo);

      const usedCount2 = usedLogs2?.length ?? 0;
      const remainingAfter = Math.max(0, maxVideoCount - usedCount2);

      return NextResponse.json({
        text,
        mode,
        planStatus,
        planTier,
        remaining: remainingAfter,
        maxLimit: maxVideoCount,
      });
    }

    // 画像モードはふつうにテキストだけ返す
    return NextResponse.json({
      text,
      mode,
    });
  } catch (e: any) {
    console.error('API /api/version error', e);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: e?.message ?? '予期せぬエラーが発生しました。',
      },
      { status: 500 },
    );
  }
}
