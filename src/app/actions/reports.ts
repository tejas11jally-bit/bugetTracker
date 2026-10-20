"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toMinor } from "@/lib/money";

export async function saveForecastThreshold(form: FormData) {
  const v = toMinor(String(form.get("threshold") || "0"), "AED") ?? 0;
  const user = await prisma.user.findFirstOrThrow();
  await prisma.user.update({ where: { id: user.id }, data: { forecastThreshold: v } });
  revalidatePath("/reports");
}
