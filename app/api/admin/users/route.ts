// app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ProfileRow {
  id: string;
  email: string | null;
  account_id: string | null;
  is_master: boolean | null;
  registered_at: string | null;
  deleted_at: string | null;
  trial_type: string | null;   // 'normal' | 'referral'
  plan_status: string | null;  // 'trial' | 'paid'
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        [
          'id',
          'email',
          'account_id',
          'is_master',
          'registered_at',
          'deleted_at',
          'trial_type',
          'plan_status',
        ].join(',')
      )
      .order('registered_at', { ascending: true });

    if (error) {
      console.error('admin users error', error);
      return NextResponse.json(
        { error: 'Failed to load users' },
        { status: 500 }
      );
    }

// Supabaseの戻り値をいったん unknown にしてから ProfileRow[] として扱う
const rows = (data ?? []) as unknown as ProfileRow[];


    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error('admin users GET error', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
