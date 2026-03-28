import { getCookie } from "cookies-next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { toast } from "@/shadcn/hooks/use-toast";
import { hasAccess } from "@/shadcn/lib/hasAccess";
import type { ComboOption } from "../Combo";

interface User {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

export function useTicketData() {
  const router = useRouter();
  const token = getCookie("session");
  const { id } = router.query;

  const [users, setUsers] = useState<User[]>();
  const [clients, setClients] = useState<Client[]>();
  const [userOptions, setUserOptions] = useState<ComboOption[]>();
  const [clientOptions, setClientOptions] = useState<ComboOption[]>();

  const fetchTicketById = async () => {
    const res = await fetch(`/api/v1/ticket/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!hasAccess(res)) {
      throw new Error("Failed to fetch ticket");
    }

    return res.json();
  };

  const { data, status, refetch } = useQuery({
    queryKey: ["ticket", id],
    queryFn: fetchTicketById,
    enabled: !!id,
    staleTime: 60_000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  async function fetchUsers() {
    try {
      const response = await fetch(`/api/v1/users/all`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!hasAccess(response)) {
        return;
      }

      const res = await response.json() as {
        success?: boolean;
        message?: string;
        users?: User[];
      };

      if (!res.success || !res.users) {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.message || "Failed to fetch users",
        });
        return;
      }

      setUsers(res.users);
      setUserOptions(
        res.users.map((user) => ({
          name: user.name,
          value: user.id,
        }))
      );
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch users",
      });
    }
  }

  async function fetchClients() {
    try {
      const response = await fetch(`/api/v1/clients/all`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!hasAccess(response)) {
        return;
      }

      const res = await response.json() as {
        success?: boolean;
        message?: string;
        clients?: Client[];
      };

      if (!res.success || !res.clients) {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.message || "Failed to fetch clients",
        });
        return;
      }

      setClients(res.clients);
      setClientOptions(
        res.clients.map((client) => ({
          name: client.name,
          value: client.id,
        }))
      );
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch clients",
      });
    }
  }

  useEffect(() => {
    fetchUsers();
    fetchClients();
  }, []);

  return {
    id,
    data,
    status,
    refetch,
    users,
    clients,
    userOptions,
    clientOptions,
  };
}
