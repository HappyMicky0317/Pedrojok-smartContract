import { expect } from "chai";
import { ethers } from "hardhat";
import { GameFactory, PaymentManager, TestToken } from "../typechain-types";
import { BN_S, BN_M, BN_L, BN_XL } from "./constants";

describe("Payment Manager", function () {
  let TestToken,
    testToken: TestToken,
    GameFactory,
    gameFactory: GameFactory,
    RewardStructure,
    rewardStructure,
    LevelLib,
    levelLib,
    PaymentManager,
    paymentManager: PaymentManager,
    deployer: any,
    addr1: any,
    addr2: any,
    addr3: any;

  before(async function () {
    [deployer, addr1, addr2, addr3] = await ethers.getSigners();

    TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy();
    await testToken.deployed();

    RewardStructure = await ethers.getContractFactory("RewardStructure");
    rewardStructure = await RewardStructure.deploy();
    await rewardStructure.deployed();

    GameFactory = await ethers.getContractFactory("GameFactory", {
      libraries: {
        RewardStructure: rewardStructure.address,
      },
    });
    gameFactory = await GameFactory.deploy();
    await gameFactory.deployed();
    await gameFactory.setAdmin(deployer.address);
    await gameFactory.setToken(testToken.address);

    LevelLib = await ethers.getContractFactory("LevelLib");
    levelLib = await LevelLib.deploy();
    await levelLib.deployed();

    PaymentManager = await ethers.getContractFactory("PaymentManager", {
      libraries: {
        LevelLib: levelLib.address,
      },
    });

    await expect(
      PaymentManager.deploy(testToken.address, ethers.constants.AddressZero, gameFactory.address)
    ).to.be.revertedWith("Zero address");

    paymentManager = await PaymentManager.deploy(testToken.address, deployer.address, gameFactory.address);
    await paymentManager.deployed();

    await testToken.approve(paymentManager.address, BN_XL);
    await gameFactory.setPaymentManager(paymentManager.address);
  });

  beforeEach(async function () {});

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await paymentManager.owner()).to.equal(deployer.address);
    });

    it("Should set the right token address", async function () {
      expect(await paymentManager.token()).to.equal(testToken.address);
    });

    it("Should set the payment address and emit an event", async function () {
      let receipt1 = await paymentManager.setNewPaymentAddress(addr1.address);
      expect(await paymentManager.paymentAddress()).to.equal(addr1.address);
      await expect(receipt1).to.emit(paymentManager, "PaymentAddressSet").withArgs(addr1.address);
      // Change payment address back
      let receipt2 = await paymentManager.setNewPaymentAddress(deployer.address);
      expect(await paymentManager.paymentAddress()).to.equal(deployer.address);
      await expect(receipt2).to.emit(paymentManager, "PaymentAddressSet").withArgs(deployer.address);
    });

    it("Should revert if restricted address not set by owner", async function () {
      await expect(paymentManager.connect(addr1).setNewPaymentAddress(addr2.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(paymentManager.connect(addr1).setMinimumLevel(10)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Should revert if payment manager is address 0", async function () {
      await expect(
        paymentManager.connect(deployer).setNewPaymentAddress(ethers.constants.AddressZero)
      ).to.be.revertedWith("Address 0");
    });
  });

  describe("Batch Withdraw", function () {
    it("Should revert if withdraw not initiated by owner", async function () {
      await expect(
        paymentManager.connect(addr1).withdrawBatch([addr1.address, addr2.address], [BN_S, BN_S])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if arrays doesn't match", async function () {
      await expect(paymentManager.connect(deployer).withdrawBatch([addr1.address], [BN_S, BN_M])).to.be.revertedWith(
        "Arrays don't match"
      );
    });

    it("Should revert if player in array doesn't exist", async function () {
      await expect(paymentManager.connect(deployer).withdrawBatch([addr2.address], [BN_S])).to.be.revertedWith(
        "Insufficient balance"
      );
    });

    it("Should revert if insufficient balance", async function () {
      // Emit new game contract
      let nameBytes32 = ethers.utils.formatBytes32String("FZero");
      let tx = await gameFactory.createNewGame(nameBytes32);
      let receipt = await tx.wait();
      const event = receipt.events!.find((event) => event.event === "NewGameCreated");
      const [owner, newGameAddress, newGameID, newGameName]: any = event!.args;
      expect(await gameFactory.getNumberOfGames()).to.equal(1);

      // Create instance for new game
      const game = await ethers.getContractAt("Game", newGameAddress, deployer);

      // Add player
      expect(game.connect(deployer).addNewPlayer("0x0", 1500, 124, BN_L, 12543, 21437)).to.be.revertedWith("Address 0");
      await game.connect(deployer).addNewPlayer(addr1.address, 1500, 124, BN_L, 12543, 21437);
      await game.connect(deployer).addNewPlayer(addr2.address, 23, 4, BN_XL, 854, 854);

      // Get player stats & check it all matches
      const stats1 = await gameFactory.getGlobalPlayerStats(addr1.address);
      expect(await stats1.player).to.equal(addr1.address);
      expect(await stats1.totalXp).to.equal(1500);
      expect(await stats1.totalSessionsPlayed).to.equal(124);
      expect(await stats1.totalClaimable).to.equal(BN_L);
      expect(await stats1.globalWon).to.equal(BN_L);

      expect(await game.isPlayerInGameId(addr3.address)).to.equal(false);
      expect(await game.isPlayerInGameId(addr1.address)).to.equal(true);
      expect(await game.playerIndex(addr1.address)).to.equal(1);

      // Try to withdraw 0
      await expect(paymentManager.withdrawBatch([addr1.address], [0])).to.be.revertedWith("Invalid amount");

      // Try to withdraw more than amount owned
      await expect(paymentManager.withdrawBatch([addr1.address], [BN_XL])).to.be.revertedWith("Insufficient balance");

      // Try to withdraw without required level
      await expect(paymentManager.withdrawBatch([addr2.address], [BN_XL])).to.be.revertedWith("Insufficient level");

      // Now update player 2 for withdrawal success
      await game.updateAllPlayersStats([addr2.address], [78, 1235, BN_L, 8543]);
    });

    it("withdraw correctly if sufficient balance and level", async function () {
      let receipt = await paymentManager.connect(deployer).withdrawBatch([addr1.address, addr2.address], [BN_L, BN_S]);
      await expect(receipt)
        .to.emit(paymentManager, "WithdrawnBatch")
        .withArgs([addr1.address, addr2.address], [BN_L, BN_S]);

      expect(await testToken.balanceOf(addr1.address)).to.equal(BN_L);
      expect(await testToken.balanceOf(addr2.address)).to.equal(BN_S);
    });
  });

  describe("Setter functions", function () {
    it("Should set the minimum amount", async function () {
      await expect(paymentManager.connect(addr1).setMinimumAmount((500 * 10 ** 18).toString())).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await paymentManager.connect(deployer).setMinimumAmount((500 * 10 ** 18).toString());
    });

    it("Should set the minimum level", async function () {
      await expect(paymentManager.connect(addr1).setMinimumLevel(2)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await paymentManager.connect(deployer).setMinimumLevel(2);
      expect(await paymentManager.minimumLevel()).to.equal(2);
    });
  });
});
