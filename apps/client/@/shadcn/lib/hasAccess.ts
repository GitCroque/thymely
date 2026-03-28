import { toast } from "@/shadcn/hooks/use-toast";

export const hasAccess = (response: Response) => {
  if (response.status === 401) {
    toast({
      title: "Unauthorized",
      description: "Please check your permissions.",
    });
  }
  if (response.status === 403) {
    toast({
      title: "Forbidden",
      description: "You do not have access to this resource.",
    });
  }

  return response.ok;
};
