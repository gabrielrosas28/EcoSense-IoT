import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

const ALGORITHM = "HS256";

export function signToken(user) {
  return jwt.sign({ email: user.email, name: user.name }, config.jwt.secret, {
    subject: user.id,
    expiresIn: config.jwt.expiresIn,
    algorithm: ALGORITHM,
  });
}

export function verifyToken(token) {
  const payload = jwt.verify(token, config.jwt.secret, { algorithms: [ALGORITHM] });
  return { id: payload.sub, email: payload.email, name: payload.name };
}
