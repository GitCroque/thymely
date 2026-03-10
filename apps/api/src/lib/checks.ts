import { FastifyReply, FastifyRequest } from "fastify";
import { checkToken } from "./jwt";
import { getSessionToken } from "./request-token";

// Check valid token
export const authenticateUser = (
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) => {
  const token = getSessionToken(request);

  if (!token) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const verified = checkToken(token);

  if (!verified) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  done();
};
