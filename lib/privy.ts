import type { PrivyClientConfig } from "@privy-io/react-auth";

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["email", "google", "wallet"],
  appearance: {
    theme: "dark",
    accentColor: "#6366f1",
    logo: undefined,
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
};
