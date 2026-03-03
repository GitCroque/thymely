import jwt from "jsonwebtoken";

export function checkToken(token: string) {
  try {
    const b64string = process.env.SECRET;
    const buf = Buffer.from(b64string!, "base64");

    return jwt.verify(token, buf);
  } catch {
    return null;
  }
}
