import type { NextRequest } from "next/server";
import { blockDates } from "@/lib/repo/bookings";
import { apiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const reservation = await blockDates({
      dashboardKey: String(body.dashboardKey ?? ""),
      listingId: String(body.listingId ?? ""),
      from: String(body.from ?? ""),
      to: String(body.to ?? ""),
    });
    return Response.json({ reservation }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
