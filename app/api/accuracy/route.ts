import { NextResponse } from "next/server";
import { getAccuracyStats, getRecentForm } from "@/lib/store";

export async function GET() {
  const [stats, recentForm] = await Promise.all([getAccuracyStats(), getRecentForm(10)]);
  return NextResponse.json({ ...stats, recentForm });
}
