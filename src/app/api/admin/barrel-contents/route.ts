import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getBarrelContentsRecordByBarrelId } from "@/data/barrel-contents";
import { barrelContentsDownloadFilename } from "@/lib/barrel-contents";
import { renderBarrelContentsPdf } from "@/lib/barrel-contents-pdf";
import { isClerkAdmin } from "@/lib/is-clerk-admin";

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

  const record = await getBarrelContentsRecordByBarrelId(parsed.data.barrelId);
  if (!record) {
    return NextResponse.json({ error: "Container not found." }, { status: 404 });
  }

  let pdf: Buffer;
  try {
    pdf = await renderBarrelContentsPdf(record);
  } catch (error) {
    console.error("[Amani Cart2Barrel] admin barrel contents PDF render failed:", error);
    return NextResponse.json(
      { error: "Could not generate the contents PDF." },
      { status: 500 },
    );
  }

  const filename = barrelContentsDownloadFilename(
    record.containerAlias || record.containerName,
  );

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
