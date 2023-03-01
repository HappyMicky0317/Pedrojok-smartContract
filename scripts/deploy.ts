require("dotenv").config();
import hre, { ethers } from "hardhat";
import fs from "fs";

const TEST_TOKEN: string = "0xE413Bfbc963fdB56Fe12A2501aa58cD4913553ef";
const PAYMENT_ADDRESS: string = "0xF0eEaAB7153Ff42849aCb0E817efEe09fb078C1b";

async function main() {
  const RewardStructure = await ethers.getContractFactory("RewardStructure");
  const rewardStructure = await RewardStructure.deploy();
  await rewardStructure.deployed();

  const GameFactory = await ethers.getContractFactory("GameFactory", {
    libraries: {
      RewardStructure: rewardStructure.address,
    },
  });
  const gameFactory = await GameFactory.deploy();
  await gameFactory.deployed();

  const LevelLib = await ethers.getContractFactory("LevelLib");
  const levelLib = await LevelLib.deploy();
  await levelLib.deployed();

  const PaymentManager = await ethers.getContractFactory("PaymentManager", {
    libraries: {
      LevelLib: levelLib.address,
    },
  });
  const paymentManager = await PaymentManager.deploy(TEST_TOKEN, PAYMENT_ADDRESS, gameFactory.address);
  await paymentManager.deployed();

  console.log("\n");
  console.log("RewardStructure deployed to:", rewardStructure.address);
  console.log("LevelLib deployed to:", levelLib.address);
  console.log("GameFactory deployed to:", gameFactory.address);
  console.log("PaymentManager deployed to:", paymentManager.address);
  console.log("\n");

  // Get ABIs
  const abiFile1 = JSON.parse(fs.readFileSync("./artifacts/contracts/GameFactory.sol/GameFactory.json", "utf8"));
  const abi1 = JSON.stringify(abiFile1.abi);
  const abiFile2 = JSON.parse(fs.readFileSync("./artifacts/contracts/PaymentManager.sol/PaymentManager.json", "utf8"));
  const abi2 = JSON.stringify(abiFile2.abi);

  console.log("GameFactory ABI:");
  console.log("\n");
  console.log(abi1);
  console.log("\n");

  console.log("PaymentManager ABI:");
  console.log("\n");
  console.log(abi2);
  console.log("\n");

  /* WAITING:
   ***********/
  await gameFactory.deployTransaction.wait(7);
  await paymentManager.deployTransaction.wait(7);

  /* VERIFICATION:
   ****************/
  await hre.run("verify:verify", {
    address: rewardStructure.address,
    constructorArguments: [],
  });
  await hre.run("verify:verify", {
    address: gameFactory.address,
    constructorArguments: [],
  });
  await hre.run("verify:verify", {
    address: levelLib.address,
    constructorArguments: [],
  });
  await hre.run("verify:verify", {
    address: paymentManager.address,
    constructorArguments: [TEST_TOKEN, PAYMENT_ADDRESS, gameFactory.address],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
