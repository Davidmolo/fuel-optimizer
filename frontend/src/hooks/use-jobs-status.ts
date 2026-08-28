import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { JobsStatusResponse } from "@/types/jobs";

export function useJobsStatus(refreshMs = 30_000) {
  const [data, setData] = useState<JobsStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await apiRequest<JobsStatusResponse>("/api/v1/jobs");
    if (response.success && response.data) {
      setData(response.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, refreshMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [load, refreshMs]);

  return { data, loading, reload: load };
}
