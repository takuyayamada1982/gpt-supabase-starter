export type AdminUsageType = 'url' | 'vision' | 'chat';

export interface AdminSummary {
  totalRequests: number;
  totalUsers: number;
  monthRequests: number;
  monthCost: number;
  monthCountsByType: {
    url: number;
    vision: number;
    chat: number;
  };
  monthCostsByType: {
    url: number;
    vision: number;
    chat: number;
  };
}

export interface MonthlyUsage {
  month: string; // 'YYYY-MM'
  urlCount: number;
  visionCount: number;
  chatCount: number;
  totalCost: number;
}

export interface TopUserUsage {
  userId: string;
  accountId: string;
  email: string;
  urlCount: number;
  visionCount: number;
  chatCount: number;
  totalCost: number;
}

export interface RecentLog {
  id: string;
  createdAt: string;
  type: AdminUsageType;
  userEmail: string;
  accountId: string;
}

export interface AdminStatsResponse {
  summary: AdminSummary;
  monthlyUsage: MonthlyUsage[];
  topUsers: TopUserUsage[];
  recentLogs: RecentLog[];
}
