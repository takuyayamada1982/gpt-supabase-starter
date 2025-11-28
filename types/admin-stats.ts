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

// …（略）※ 長いので必要なら再送します！
