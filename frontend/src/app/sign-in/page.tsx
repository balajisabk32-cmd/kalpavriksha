import { redirect } from "next/navigation";
import { getSessionUser, homeFor, safeNext } from "@/server/auth/current-user";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in — Kalpavriksha" };

export default async function SignInPage(props: PageProps<"/sign-in">) {
  const { next } = await props.searchParams;
  const nextPath = safeNext(Array.isArray(next) ? next[0] : next);
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  return <SignInForm next={nextPath ?? ""} />;
}
