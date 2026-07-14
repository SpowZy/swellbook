import type { NextRequest } from "next/server";
import { cancelBlock } from "@/lib/repo/bookings";
import { apiError } from "@/lib/api";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    await cancelBlock({ dashboardKey: String(body.dashboardKey ?? ""), reservationId: id });
    return Response.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
