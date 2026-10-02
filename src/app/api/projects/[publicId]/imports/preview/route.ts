import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ data: { tasks: 1, links: 0 } });
}
