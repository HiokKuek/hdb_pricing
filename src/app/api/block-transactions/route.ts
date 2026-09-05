import { NextRequest, NextResponse } from "next/server";
import { getBlockTransactions } from "@/lib/blocks";

export async function GET(request: NextRequest) {
  const blockId = request.nextUrl.searchParams.get("blockId")?.trim();
  if (!blockId) return NextResponse.json({ error: "Choose a block." }, { status: 400 });
  return NextResponse.json({ transactions: await getBlockTransactions(blockId) });
}
