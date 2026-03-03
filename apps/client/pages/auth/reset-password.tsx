import { toast } from "@/shadcn/hooks/use-toast";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function ResetPassword() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [tokenValid, setTokenValid] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  useEffect(() => {
    async function validateToken() {
      const token = Array.isArray(router.query.token)
        ? router.query.token[0]
        : router.query.token;

      if (!token) {
        setCheckingToken(false);
        return;
      }

      const res = await fetch(`/api/v1/auth/password-reset/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).then((response) => response.json());

      setTokenValid(Boolean(res.success));
      setCheckingToken(false);

      if (!res.success) {
        toast({
          variant: "destructive",
          title: "Lien invalide",
          description:
            "Le lien de réinitialisation est invalide ou expiré. Recommence la procédure.",
        });
      }
    }

    validateToken();
  }, [router.query.token]);

  async function updatePassword() {
    const token = Array.isArray(router.query.token)
      ? router.query.token[0]
      : router.query.token;

    if (!token) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Lien de réinitialisation invalide.",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères.",
      });
      return;
    }

    const res = await fetch(`/api/v1/auth/password-reset/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).then((response) => response.json());

    if (res.success) {
      toast({
        variant: "default",
        title: "Succès",
        description: "Mot de passe mis à jour.",
      });
      router.push("/auth/login");
      return;
    }

    toast({
      variant: "destructive",
      title: "Erreur",
      description:
        "Impossible de modifier le mot de passe. Le lien est peut-être expiré.",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Réinitialiser le mot de passe
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {checkingToken ? (
            <p>Vérification du lien...</p>
          ) : tokenValid ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nouveau mot de passe
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={updatePassword}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Changer le mot de passe
              </button>
            </div>
          ) : (
            <p>Ce lien de réinitialisation est invalide ou expiré.</p>
          )}
        </div>
      </div>
    </div>
  );
}
