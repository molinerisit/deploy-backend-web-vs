// backend/generate-keys.mjs
import { generateKeyPairSync } from "crypto";
import { writeFileSync } from "fs";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },   // PUBLIC KEY
  privateKeyEncoding: { type: "pkcs8", format: "pem" }  // PRIVATE KEY
});

writeFileSync("license_public.pem", publicKey);
writeFileSync("license_private.pem", privateKey);

// Pasar a base64 para .env
const b64pub  = Buffer.from(publicKey, "utf8").toString("base64");
const b64priv = Buffer.from(privateKey, "utf8").toString("base64");

console.log("LICENSE_PUBLIC_KEY_B64=" + b64pub);
console.log("LICENSE_PRIVATE_KEY_B64=" + b64priv);
console.log("\nSe generaron license_public.pem y license_private.pem");
