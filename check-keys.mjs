import "dotenv/config";
import { createSign, createVerify } from "crypto";

function b64(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name}`);
  return Buffer.from(v, "base64").toString("utf8");
}

const privPem = b64("LICENSE_PRIVATE_KEY_B64");
const pubPem  = b64("LICENSE_PUBLIC_KEY_B64");

const data = Buffer.from("ping");
const sign = createSign("RSA-SHA256");
sign.update(data);
const sig = sign.sign(privPem);

const verify = createVerify("RSA-SHA256");
verify.update(data);
const ok = verify.verify(pubPem, sig);

console.log("Firma/verificación OK?:", ok);
