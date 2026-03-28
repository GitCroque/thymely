import { toast } from "@/shadcn/hooks/use-toast";
import { hasAccess } from "@/shadcn/lib/hasAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/shadcn/ui/card";
import { getCookie } from "cookies-next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

type RoleSummary = {
  id: string;
  name: string;
  permissions: string[];
  users: { id: string }[];
  active: boolean;
};

type RolesResponse = {
  success?: boolean;
  message?: string;
  roles?: RoleSummary[];
  roles_active?: { roles_active: boolean } | null;
};

type RoleMutationResponse = {
  success?: boolean;
  message?: string;
};

export default function Roles() {
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [isAllRolesActive, setIsAllRolesActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mutatingRoleId, setMutatingRoleId] = useState<string | null>(null);
  const [isTogglingAll, setIsTogglingAll] = useState(false);
  const router = useRouter();

  async function requestJson<T extends RoleMutationResponse>(
    url: string,
    init?: RequestInit
  ) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${getCookie("session")}`,
        ...(init?.headers || {}),
      },
    });

    if (!hasAccess(response)) {
      const body = await response.json().catch(() => null) as RoleMutationResponse | null;
      throw new Error(body?.message || "Unauthorized");
    }

    const body = await response.json() as T;
    if (!response.ok || body.success === false) {
      throw new Error(body.message || "Request failed");
    }

    return body;
  }

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const data = await requestJson<RolesResponse>("/api/v1/roles/all");
      setRoles(data.roles ?? []);
      setIsAllRolesActive(Boolean(data.roles_active?.roles_active));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to load roles",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRoles();
  }, []);

  const handleDeleteRole = async (roleId: string) => {
    if (!window.confirm("Are you sure you want to delete this role?")) return;

    setMutatingRoleId(roleId);
    try {
      await requestJson<RoleMutationResponse>(`/api/v1/role/${roleId}/delete`, {
        method: "DELETE",
      });
      toast({
        title: "Role deleted",
        description: "The role has been removed successfully.",
      });
      await fetchRoles();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to delete role",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setMutatingRoleId(null);
    }
  };

  const handleToggleRole = async (roleId: string, isActive: boolean) => {
    setMutatingRoleId(roleId);
    try {
      await requestJson<RoleMutationResponse>(`/api/v1/role/${roleId}/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !isActive }),
      });
      toast({
        title: "Role status updated",
        description: `Role ${isActive ? "disabled" : "enabled"} successfully.`,
      });
      await fetchRoles();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to update role",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setMutatingRoleId(null);
    }
  };

  const handleToggleAllRoles = async (isActive: boolean) => {
    setIsTogglingAll(true);
    try {
      await requestJson<RoleMutationResponse>(`/api/v1/config/toggle-roles`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive }),
      });
      toast({
        title: "Role status updated",
        description: "Roles have been updated successfully.",
      });
      await fetchRoles();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to update roles",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsTogglingAll(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-green-500 text-white rounded"
            onClick={() => {
              void router.push("/admin/roles/new");
            }}
          >
            Add Role
          </button>
          <button
            className="px-4 py-2 bg-yellow-500 text-white rounded disabled:opacity-60"
            disabled={isTogglingAll}
            onClick={() => {
              void handleToggleAllRoles(false);
            }}
          >
            Disable All Roles
          </button>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-60"
            disabled={isTogglingAll}
            onClick={() => {
              void handleToggleAllRoles(true);
            }}
          >
            Enable All Roles
          </button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <span
            className={`px-2 py-0.5 text-xs rounded ${
              isAllRolesActive
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {isAllRolesActive ? "Active" : "Inactive"}
          </span>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div>No roles available</div>
          ) : (
            <ul>
              {roles.map((role) => (
                <li key={role.id} className="border-b py-2">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <strong>{role.name}</strong>
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            role.active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {role.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        ID: {role.id}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className={`px-3 py-1 text-white rounded text-sm disabled:opacity-60 ${
                          role.active ? "bg-yellow-500" : "bg-green-500"
                        }`}
                        disabled={mutatingRoleId === role.id}
                        onClick={() => {
                          void handleToggleRole(role.id, role.active);
                        }}
                      >
                        {role.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                        onClick={() => {
                          void router.push(`/admin/roles/${role.id}`);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm disabled:opacity-60"
                        disabled={mutatingRoleId === role.id}
                        onClick={() => {
                          void handleDeleteRole(role.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
