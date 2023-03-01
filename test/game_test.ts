import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { BN_S, BN_M, BN_L, BN_XL, name1Bytes32, infiniteApproval, name2Bytes32 } from "./constants";

describe("GameFactory", function () {
  let TestToken,
    testToken: Contract,
    GameFactory,
    gameFactory: Contract,
    RewardStructure,
    rewardStructure,
    LevelLib,
    levelLib,
    PaymentManager,
    paymentManager,
    deployer: any,
    addr1: any,
    addr2: any,
    addr3: any,
    addr4: any,
    addr5: any;

  before(async function () {
    [deployer, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();

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
    await gameFactory.setToken(testToken.address);

    LevelLib = await ethers.getContractFactory("LevelLib");
    levelLib = await LevelLib.deploy();
    await levelLib.deployed();

    PaymentManager = await ethers.getContractFactory("PaymentManager", {
      libraries: {
        LevelLib: levelLib.address,
      },
    });
    paymentManager = await PaymentManager.deploy(testToken.address, deployer.address, gameFactory.address);
    await paymentManager.deployed();

    await testToken.approve(paymentManager.address, infiniteApproval.toString());
    await expect(gameFactory.createNewGame(name1Bytes32)).to.be.revertedWith("Address 0");
    await gameFactory.setAdmin(deployer.address);
    await expect(gameFactory.createNewGame(name1Bytes32)).to.be.revertedWith("Address 0");
    await gameFactory.setPaymentManager(paymentManager.address);
  });

  beforeEach(async function () {
    await gameFactory.createNewGame(name1Bytes32);
    await gameFactory.createNewGame(name2Bytes32);
  });

  describe("Game", function () {
    it("Should create new games succesfully", async function () {
      const gameAddress = await gameFactory.getGamePerIndex(0);
      const gameAddress2 = await gameFactory.getGamePerIndex(1);

      const game = await ethers.getContractAt("Game", gameAddress, deployer);
      expect(await game.gameName()).to.equal(name1Bytes32);
      expect(await game.gameID()).to.equal(0);

      const game2 = await ethers.getContractAt("Game", gameAddress2, deployer);
      expect(await game2.gameName()).to.equal(name2Bytes32);
      expect(await game2.gameID()).to.equal(1);
    });

    it("Should revert when adding new players if unauthorized", async function () {
      const gameAddress = await gameFactory.getGamePerIndex(0);
      const game = await ethers.getContractAt("Game", gameAddress, deployer);

      await expect(game.connect(addr2).addNewPlayer(addr1.address, 900, 114, BN_L, 1543, 10250)).to.be.revertedWith(
        "Not authorized"
      );
    });

    it("Should be possible to add new players when owner / admin / paymentManager", async function () {
      const gameAddress = await gameFactory.getGamePerIndex(0);
      const game = await ethers.getContractAt("Game", gameAddress, deployer);

      // Adding address 0 should fail!
      await expect(
        game.connect(deployer).addNewPlayer(ethers.constants.AddressZero, 900, 114, BN_L, 7543, 10250)
      ).to.be.revertedWith("Address 0");
      await game.connect(deployer).addNewPlayer(addr1.address, 900, 114, BN_L, 7543, 10250);

      // Adding same player should fail!
      await expect(game.connect(deployer).addNewPlayer(addr1.address, 900, 114, BN_L, 7543, 10250)).to.be.revertedWith(
        "Existing user"
      );
      // Adding different player should pass
      await game.connect(deployer).addNewPlayer(addr2.address, 700, 99, BN_S, 6450, 9980);

      expect(await game.numberOfPlayers()).to.equal(2);
    });

    it("Shouldn't be possible to update players stats without valid array", async function () {
      const gameAddress = await gameFactory.getGamePerIndex(0);
      const game = await ethers.getContractAt("Game", gameAddress, deployer);

      expect(await game.numberOfPlayers()).to.equal(2);

      await expect(
        game.updateAllPlayersStats([addr1.address, addr2.address], [14, 246, BN_S, 8543, 6, 146, BN_S])
      ).to.be.revertedWith("Wrong parameters");
    });

    it("Should ditribute weekly reward accordingly", async function () {
      const gameAddress = await gameFactory.getGamePerIndex(0);
      const game = await ethers.getContractAt("Game", gameAddress, deployer);

      await game.addNewPlayer(addr3.address, 1300, 187, BN_XL, 10450, 10450);
      await game.addNewPlayer(addr4.address, 400, 34, BN_S, 3450, 4412);
      await game.addNewPlayer(addr5.address, 890, 79, BN_M, 5450, 6980);

      expect(await game.numberOfPlayers()).to.equal(5);

      await testToken.approve(game.address, infiniteApproval.toString());

      await expect(game.distributeRewards(BN_XL, 2)).to.be.revertedWith("invalid value");

      await game.distributeRewards(BN_XL, 3);

      const statPlayer1 = await game.getPlayerStats(addr1.address);
      expect(statPlayer1.rankingScore).to.equal(7543);

      const statPlayer3 = await game.getPlayerStats(addr3.address);
      expect(statPlayer3.rankingScore).to.equal(10450);

      expect(await testToken.balanceOf(addr1.address)).to.equal((300 * 10 ** 18).toString());
      expect(await testToken.balanceOf(addr2.address)).to.equal((200 * 10 ** 18).toString());
      expect(await testToken.balanceOf(addr3.address)).to.equal((500 * 10 ** 18).toString());
      expect(await testToken.balanceOf(addr4.address)).to.equal(0);
      expect(await testToken.balanceOf(addr5.address)).to.equal(0);
    });

    it("Should reset all ranking score", async function () {
      const gameAddress = await gameFactory.getGamePerIndex(0);
      const game = await ethers.getContractAt("Game", gameAddress, deployer);

      // reset all weekly scores
      await game.resetAllrankingScores();

      const statPlayer1 = await game.getPlayerStats(addr1.address);
      expect(statPlayer1.rankingScore).to.equal(0);

      const statPlayer2 = await game.getPlayerStats(addr2.address);
      expect(statPlayer2.rankingScore).to.equal(0);

      const statPlayer3 = await game.getPlayerStats(addr3.address);
      expect(statPlayer3.rankingScore).to.equal(0);
    });
  });
});
