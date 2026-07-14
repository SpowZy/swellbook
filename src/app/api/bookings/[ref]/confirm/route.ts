import { confirmReservation } from "@/lib/repo/bookings";
import { apiError } from "@/lib/api";

export async function POST(_req: Request, ctx: { params: Promise<{ ref: string }> }) {
  try {
    const { ref } = await ctx.params;
    const reservation = await confirmReservation(ref);
    return Response.json({ reservation });
  } catch (err) {
    return apiError(err);
  }
}
