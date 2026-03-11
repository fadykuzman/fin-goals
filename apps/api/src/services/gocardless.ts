import NordigenClient from "nordigen-node";

const secretId = process.env.GOCARDLESS_SECRET_ID;
const secretKey = process.env.GOCARDLESS_SECRET_KEY;

if (!secretId || !secretKey) {
  throw new Error(
    "Missing GOCARDLESS_SECRET_ID or GOCARDLESS_SECRET_KEY env vars"
  );
}

export const client = new NordigenClient({
  secretId,
  secretKey,
  baseUrl: "https://bankaccountdata.gocardless.com/api/v2",
});

export async function getAccessToken(): Promise<string> {
  const tokenData = await client.generateToken();
  return tokenData.access;
}

export async function getAccountBalances(accountId: string) {
  await getAccessToken();
  return client.account(accountId).getBalances();
}
