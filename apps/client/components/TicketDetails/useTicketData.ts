import { getCookie } from "cookies-next";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { toast } from "@/shadcn/hooks/use-toast";
import { hasAccess } from "@/shadcn/lib/hasAccess";

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

  const fetchTicketById = async () => {
    const res = await fetch(`/api/v1/ticket/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    hasAccess(res);

    return res.json();
  };

  const { data, status, refetch } = useQuery({
    queryKey: ["fetchTickets"],
    queryFn: fetchTicketById,
    enabled: false,
  });

  useEffect(() => {
    refetch();
  }, [router]);

  async function fetchUsers() {
    const res = await fetch(`/api/v1/users/all`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: res.message || "Failed to fetch users",
      });
      return;
    }

    if (res.users) {
      setUsers(res.users);
    }
  }

  async function fetchClients() {
    const res = await fetch(`/api/v1/clients/all`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: res.message || "Failed to fetch clients",
      });
      return;
    }

    if (res.clients) {
      setClients(res.clients);
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
  };
}
