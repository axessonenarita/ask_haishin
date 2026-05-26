import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function POST() {
  const err = new Error(
    `manual test: server-side error @ ${new Date().toISOString()}`,
  );
  Sentry.captureException(err);
  await Sentry.flush(3000);
  return NextResponse.json({ error: err.message }, { status: 500 });
}
