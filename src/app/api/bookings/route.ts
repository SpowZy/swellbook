import type { NextRequest } from "next/server";
import { createHold } from "@/lib/repo/bookings";
import { apiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idempotencyKey = req.headers.get("idempotency-key") ?? body.idempotencyKey ?? "";
    const reservation = await createHold({
      listingSlug: String(body.listingSlug ?? ""),
      checkIn: String(body.checkIn ?? ""),
      checkOut: String(body.checkOut ?? ""),
      guestName: String(body.guestName ?? ""),
      guestEmail: String(body.guestEmail ?? ""),
      idempotencyKey: String(idempotencyKey),
    });
    return Response.json({ reservation }, { status: reservation.replayed ? 200 : 201 });
  } catch (err) {
    return apiError(err);
  }
}
