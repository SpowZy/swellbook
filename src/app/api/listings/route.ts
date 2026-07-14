import type { NextRequest } from "next/server";
import { createListing } from "@/lib/repo/listings";
import { apiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const created = await createListing({
      hostName: String(body.hostName ?? ""),
      hostStory: String(body.hostStory ?? ""),
      name: String(body.name ?? ""),
      place: String(body.place ?? ""),
      country: String(body.country ?? ""),
      capacity: Number(body.capacity ?? 0),
      pricePerNightCents: Number(body.pricePerNightCents ?? 0),
      vibeTags: Array.isArray(body.vibeTags) ? body.vibeTags.map(String) : [],
      story: String(body.story ?? ""),
      hue: Number(body.hue ?? 200),
    });
    return Response.json(created, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
