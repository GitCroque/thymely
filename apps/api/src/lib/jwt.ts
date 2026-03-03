import jwt from "jsonwebtoken";

export function checkToken(token: string) {
  const bearer = token;

  const b64string = process.env.SECRET;
  const buf = Buffer.from(b64string!, "base64");

  const verified = jwt.verify(bearer, buf);

  return verified;
}
