import type { SupabaseClient } from "@supabase/supabase-js";

export async function selectAllByOwner(
  db: SupabaseClient,
  table: string,
  ownerId: string,
  columns = "*",
  pageSize = 1000,
): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from(table).select(columns).eq("owner_id", ownerId).range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}
