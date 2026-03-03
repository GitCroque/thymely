import { useRouter } from "next/router";
import { useEffect } from "react";

export default function Login() {
  const router = useRouter();

  async function check() {
    const code = Array.isArray(router.query.code)
      ? router.query.code[0]
      : router.query.code;
    const state = Array.isArray(router.query.state)
      ? router.query.state[0]
      : router.query.state;
    const sessionState = Array.isArray(router.query.session_state)
      ? router.query.session_state[0]
      : router.query.session_state;
    const issuer = Array.isArray(router.query.iss)
      ? router.query.iss[0]
      : router.query.iss;

    if (code && state) {
      const sso = await fetch(
        `/api/v1/auth/oidc/callback?state=${state}&code=${code}&session_state=${sessionState || ""}&iss=${issuer || ""}`,
        {
          credentials: "include",
        }
      ).then((res) => res.json());

      if (!sso.success) {
        router.push("/auth/login?error=account_not_found");
      } else {
        setandRedirect(sso.onboarding);
      }
    }
  }

  function setandRedirect(onboarding: boolean) {
    router.push(onboarding ? "/onboarding" : "/");
  }

  useEffect(() => {
    check();
  }, [router]);

  return <div></div>;
}
