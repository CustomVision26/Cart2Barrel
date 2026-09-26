import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCustomsClearancePackPdfPayload } from "@/data/customs-clearance-pack";
import { renderCustomsClearancePackPdf } from "@/lib/invoice/render-customs-clearance-pack-pdf";

export const runtime = "nodejs";

const querySchema = z.object({
  barrelId: z.string().uuid(),
  disposition: z.enum(["inline", "attachment"]).optional(),
});

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    barrelId: url.searchParams.get("barrelId")?.trim(),
    disposition: url.searchParams.get("disposition")?.trim() || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid container." }, { status: 400 });
  }

  const payload = await getCustomsClearancePackPdfPayload(parsed.data.barrelId, {
    clerkUserId: userId,
    requirePublished: true,
  });
  if (!payload) {
    return NextResponse.json({ error: "Container not found." }, { status: 404 });
  }

  let pdf: Buffer;
  try {
    pdf = await renderCustomsClearancePackPdf(payload);
  } catch (error) {
    console.error(
      "[Amani Cart2Barrel] customer customs clearance pack PDF render failed:",
      error,
    );
    return NextResponse.json(
      { error: "Could not generate the clearance PDF." },
      { status: 500 },
    );
  }

  const disposition = parsed.data.disposition ?? "inline";
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${payload.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
