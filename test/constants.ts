import { ethers } from "hardhat";

export const decimals = 18;
export const infiniteApproval = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const amountS = (100).toString();
const amountM = (500).toString();
const amountL = (750).toString();
const amountXL = (1000).toString();

export const BN_S = ethers.utils.parseUnits(amountS, decimals);
export const BN_M = ethers.utils.parseUnits(amountM, decimals);
export const BN_L = ethers.utils.parseUnits(amountL, decimals);
export const BN_XL = ethers.utils.parseUnits(amountXL, decimals);

export const name1Bytes32 = ethers.utils.formatBytes32String("StreeFighterII");
export const name2Bytes32 = ethers.utils.formatBytes32String("Doom");
export const name3Bytes32 = ethers.utils.formatBytes32String("Fzero");

export const getAddressFromEvent = (receipt: any) => {
  const event = receipt.events.find((event: { event: string }) => event.event === "NewGameCreated");
  const [owner, newGameAddress, newGameID, newGameName] = event.args;
  return newGameAddress;
};
