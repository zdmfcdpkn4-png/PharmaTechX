import { NextResponse } from "next/server";
import { baseConfiguree, baseJoignable } from "@/lib/db";
import { modeStockage } from "@/lib/stockage";
import { modeConservation } from "@/lib/config";
import { secretConfigure } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Page de santé pour l'hébergeur (Render : healthCheckPath) et pour l'exploitant. */
export async function GET() {
  const base = baseConfiguree();
  const joignable = base ? await baseJoignable() : false;
  return NextResponse.json(
    {
      ok: true,
      base: base ? (joignable ? "joignable" : "injoignable") : "non-configuree",
      stockage: modeStockage(),
      conservation: modeConservation(),
      secret: secretConfigure() ? "defini" : "absent",
    },
    { status: base && !joignable ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
