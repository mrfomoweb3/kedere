import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton() {
  return (
    <ConnectButton
      showBalance={false}
      accountStatus="address"
      chainStatus="icon"
    />
  );
}
