import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCustomsClearancePackPdfPayload } from "@/data/customs-clearance-pack";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { renderCustomsClearancePackPdf } from "@/lib/invoice/render-customs-clearance-pack-pdf";

export const runtime = "nodejs";

const querySchema = z.object({
  barrelId: z.string().uuid(),
});

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = querySchema.safeParse({
    barrelId: new URL(request.url).searchParams.get("barrelId")?.trim(),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid container." }, { status: 400 });
  }

  const payload = await getCustomsClearancePackPdfPayload(parsed.data.barrelId);
  if (!payload) {
    return NextResponse.json({ error: "Container not found." }, { status: 404 });
  }

  let pdf: Buffer;
  try {
    pdf = await renderCustomsClearancePackPdf(payload);
  } catch (error) {
    console.error(
      "[Amani Cart2Barrel] customs clearance pack PDF render failed:",
      error,
    );
    return NextResponse.json(
      { error: "Could not generate the clearance PDF." },
      { status: 500 },
    );
  }

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${payload.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
