import { createPublicClient, http } from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});

export async function resolveEnsName(name: string): Promise<string | null> {
  try {
    const address = await publicClient.getEnsAddress({
      name: normalize(name),
    });
    return address;
  } catch {
    return null;
  }
}

export async function lookupEnsName(address: `0x${string}`): Promise<string | null> {
  try {
    const name = await publicClient.getEnsName({ address });
    return name;
  } catch {
    return null;
  }
}

export function isEnsName(value: string): boolean {
  return value.endsWith(".eth");
}
