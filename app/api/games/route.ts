import { NextResponse } from "next/server";
import { getGamesData } from "@/lib/games";

export async function GET() {
  const data = await getGamesData();
  if (data.error) {
    return NextResponse.json(data, { status: 500 });
  }
  return NextResponse.json(data);
}
