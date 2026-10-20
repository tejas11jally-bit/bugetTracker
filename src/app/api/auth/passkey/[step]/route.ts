import { cookies } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { getUserOrNull, readSigned, signValue, startSession } from "@/lib/auth";

// Optional passkey (Face ID) login. Registration requires an existing session.
const CHALLENGE_COOKIE = "ledgerly_challenge";

function origin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}

async function setChallenge(challenge: string) {
  (await cookies()).set(CHALLENGE_COOKIE, signValue({ challenge, exp: Date.now() + 5 * 60_000 }), { httpOnly: true, sameSite: "strict", path: "/", maxAge: 300 });
}

async function takeChallenge() {
  const jar = await cookies();
  const v = readSigned<{ challenge: string; exp: number }>(jar.get(CHALLENGE_COOKIE)?.value);
  jar.delete(CHALLENGE_COOKIE);
  return v && v.exp > Date.now() ? v.challenge : null;
}

const transports = (s: string) => (s ? (s.split(",") as AuthenticatorTransportFuture[]) : undefined);

export async function POST(req: Request, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const { rpID, origin: expectedOrigin } = origin(req);
  const fail = (error: string, status = 400) => Response.json({ error }, { status });

  if (step === "register-options" || step === "register-verify") {
    const user = await getUserOrNull();
    if (!user) return fail("Sign in first", 401);
    const existing = await prisma.passkey.findMany();

    if (step === "register-options") {
      const options = await generateRegistrationOptions({
        rpName: "Ledgerly",
        rpID,
        userName: user.email,
        userDisplayName: user.name,
        attestationType: "none",
        excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: transports(p.transports) })),
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      });
      await setChallenge(options.challenge);
      return Response.json(options);
    }

    const body = await req.json();
    const expectedChallenge = await takeChallenge();
    if (!expectedChallenge) return fail("Expired, try again");
    try {
      const result = await verifyRegistrationResponse({ response: body.response, expectedChallenge, expectedOrigin, expectedRPID: rpID });
      if (!result.verified || !result.registrationInfo) return fail("Could not verify passkey");
      const { credential } = result.registrationInfo;
      await prisma.passkey.create({
        data: {
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: credential.counter,
          transports: (credential.transports ?? []).join(","),
          label: String(body.label || "Passkey").slice(0, 60),
        },
      });
      return Response.json({ ok: true });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Verification failed");
    }
  }

  if (step === "login-options") {
    const keys = await prisma.passkey.findMany();
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: keys.map((p) => ({ id: p.credentialId, transports: transports(p.transports) })),
      userVerification: "preferred",
    });
    await setChallenge(options.challenge);
    return Response.json(options);
  }

  if (step === "login-verify") {
    const body = await req.json();
    const expectedChallenge = await takeChallenge();
    if (!expectedChallenge) return fail("Expired, try again");
    const key = await prisma.passkey.findUnique({ where: { credentialId: body.id } });
    if (!key) return fail("Unknown passkey");
    try {
      const result = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: { id: key.credentialId, publicKey: new Uint8Array(key.publicKey), counter: key.counter, transports: transports(key.transports) },
      });
      if (!result.verified) return fail("Face ID sign-in failed", 401);
      await prisma.passkey.update({ where: { id: key.id }, data: { counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() } });
      const user = await prisma.user.findFirstOrThrow();
      await startSession(user.id);
      return Response.json({ ok: true });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Verification failed", 401);
    }
  }

  return fail("Not found", 404);
}
