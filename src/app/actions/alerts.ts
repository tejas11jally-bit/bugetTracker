"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function markAllRead() {
  await prisma.alert.updateMany({ where: { read: false }, data: { read: true } });
  revalidatePath("/", "layout");
}

export async function clearRead() {
  await prisma.alert.deleteMany({ where: { read: true } });
  revalidatePath("/alerts");
}
