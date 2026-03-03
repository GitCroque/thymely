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

    if (code && state) {
      const sso = await fetch(
        `/api/v1/auth/oauth/callback?code=${code}&state=${state}`,
        {
          credentials: "include",
        }
      ).then((res) => res.json());

      if (!sso.success) {
        router.push("/auth/login?error=account_not_found");
      } else {
        setandRedirect();
      }
    }
  }

  function setandRedirect() {
    router.push("/onboarding");
  }

  useEffect(() => {
    check();
  }, [router]);

  return <div></div>;
}
