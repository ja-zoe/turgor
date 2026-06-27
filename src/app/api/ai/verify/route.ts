import { NextRequest } from "next/server";
import { generateText } from "ai";
import { auth } from "@/auth";
import { resolveModel, AiProvider } from "@/lib/ai-provider";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { provider, apiKey, model } = await req.json();

  if (!provider || !apiKey || !model) {
    return Response.json({ ok: false, error: "Missing provider, apiKey, or model" }, { status: 400 });
  }

  try {
    const aiModel = resolveModel(provider as AiProvider, apiKey as string, model as string);
    await generateText({
      model: aiModel,
      prompt: "hi",
    });
    return Response.json({ ok: true });
  } catch (e) {
    const raw = e as { message?: string; statusCode?: number; status?: number };
    const message =
      raw?.message?.replace(/\n+/g, " ").slice(0, 200) ??
      "Could not verify key — check that it is correct and has sufficient quota.";
    return Response.json({ ok: false, error: message });
  }
}
