import { expect } from "chai";
import { ethers } from "hardhat";
import { GameFactory, PaymentManager, TestToken } from "../typechain-types";
import { BN_S, BN_M, BN_L, name1Bytes32, getAddressFromEvent, infiniteApproval } from "./constants";

describe("GameFactory", function () {
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
  });

  beforeEach(async function () {
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
    paymentManager = await PaymentManager.deploy(testToken.address, deployer.address, gameFactory.address);
    await paymentManager.deployed();

    await testToken.approve(paymentManager.address, infiniteApproval.toString());
    await gameFactory.setPaymentManager(paymentManager.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await gameFactory.owner()).to.equal(deployer.address);
    });
    it("Should have 0 game contract to start", async function () {
      expect(await gameFactory.getNumberOfGames()).to.equal(0);
    });
  });

  describe("set Payment Manager", function () {
    it("Should set the new Payment Manager address", async function () {
      await expect(gameFactory.setPaymentManager(ethers.constants.AddressZero)).to.be.revertedWith("Address 0");

      const setPaymentManager = await gameFactory.setPaymentManager(paymentManager.address);
      await setPaymentManager.wait();
    });

    it("Should set the right token for paymentManager", async function () {
      expect(await paymentManager.token()).to.equal(testToken.address);
    });

    it("Should set the right payment address for paymentManager", async function () {
      expect(await paymentManager.paymentAddress()).to.equal(deployer.address);
    });
  });

  describe("Create New Game", function () {
    it("Should create a new game succesfully", async function () {
      const tx = await gameFactory.createNewGame(name1Bytes32);
      const receipt = await tx.wait();
      const event = receipt.events!.find((event) => event.event === "NewGameCreated");
      const [_owner, newGameAddress, newGameID, newGameName]: any = event!.args;

      const gameAddress = await gameFactory.getGamePerIndex(newGameID);
      expect(gameAddress).to.equal(newGameAddress);

      const gameId = await gameFactory.getGameId(name1Bytes32);
      expect(gameId).to.equal(newGameID);

      expect(ethers.utils.parseBytes32String(newGameName)).to.equal("StreeFighterII");
      expect(await gameFactory.getNumberOfGames()).to.equal(1);
      expect(await gameFactory.getGameAddress(newGameID)).to.equal(newGameAddress);
    });
  });

  it("Should be possible to create a new game and add players", async function () {
    const tx = await gameFactory.createNewGame(name1Bytes32);
    const receipt = await tx.wait();
    const gameAddr1 = getAddressFromEvent(receipt);

    // Create instance for new game
    const game = await ethers.getContractAt("Game", gameAddr1, deployer);
    expect(await game.gameName()).to.equal(name1Bytes32);
    expect(await game.gameID()).to.equal(0);

    // Add players
    expect(game.connect(deployer).addNewPlayer("0x0", 1500, 124, BN_L, 12543, 21437)).to.be.revertedWith("Address 0");
    await game.connect(deployer).addNewPlayer(addr1.address, 900, 114, BN_L, 1543, 1543);
    await game.connect(deployer).addNewPlayer(addr2.address, 1100, 88, BN_M, 6746, 8543);
  });

  it("Should be possible to update all players in a batch", async function () {
    // Create game 1
    const tx1 = await gameFactory.createNewGame(name1Bytes32);
    const receipt1 = await tx1.wait();
    const gameAddr1 = getAddressFromEvent(receipt1);
    const game1 = await ethers.getContractAt("Game", gameAddr1, deployer);

    // Create game 2
    const tx2 = await gameFactory.createNewGame(name1Bytes32);
    const receipt2 = await tx2.wait();
    const gameAddr2 = getAddressFromEvent(receipt2);
    const game2 = await ethers.getContractAt("Game", gameAddr2, deployer);

    expect(await gameFactory.getNumberOfGames()).to.equal(2);

    // Add 2 players to game 1
    await game1.connect(deployer).addNewPlayer(addr1.address, 900, 114, BN_L, 1543, 10250);
    await game1.connect(deployer).addNewPlayer(addr2.address, 1100, 88, BN_M, 6746, 8543);

    // Add 3 players to game 2
    await game2.connect(deployer).addNewPlayer(addr1.address, 1500, 124, BN_L, 12543, 21437);
    await game2.connect(deployer).addNewPlayer(addr2.address, 1200, 98, BN_M, 8746, 12543);
    await game2.connect(deployer).addNewPlayer(addr3.address, 850, 54, BN_S, 6435, 9864);

    // Batch update players
    await game1.updateAllPlayersStats([addr1.address, addr2.address], [14, 246, BN_S, 8543, 6, 146, BN_S, 6243]);
    await game2.updateAllPlayersStats([addr1.address, addr3.address], [14, 246, BN_S, 8543, 6, 146, BN_S, 10243]);

    // Check stats per players for game 1
    const stat1Player1 = await game1.getPlayerStats(addr1.address);
    expect(stat1Player1.xp).to.equal(900 + 246); // (xp when added + update)
    expect(stat1Player1.sessionsPlayed).to.equal(114 + 14); // (session played when added + update)
    expect(stat1Player1.rankingScore).to.equal(8543); // (8543 > 1543)
    expect(stat1Player1.bestScore).to.equal(10250); // (10250 > 8543)
    expect(stat1Player1.claimable).to.equal(BN_L.add(BN_S).toString()); // (Token when added + update)

    const stat1Player2 = await game1.getPlayerStats(addr2.address);
    expect(stat1Player2.xp).to.equal(1100 + 146); // (xp when added + update)
    expect(stat1Player2.sessionsPlayed).to.equal(88 + 6); // (session played when added + update)
    expect(stat1Player2.rankingScore).to.equal(6746); // (6746 > 6243)
    expect(stat1Player2.bestScore).to.equal(8543); // (8543 > 6746)
    expect(stat1Player2.claimable).to.equal(BN_M.add(BN_S).toString()); // (Token when added + update)

    // Check stats per players for game 2
    const stat2Player1 = await game2.getPlayerStats(addr1.address);
    expect(stat2Player1.xp).to.equal(1500 + 246); // (xp when added + update)
    expect(stat2Player1.sessionsPlayed).to.equal(124 + 14); // (session played when added + update)
    expect(stat2Player1.rankingScore).to.equal(12543); // (12543 > 8543)
    expect(stat2Player1.bestScore).to.equal(21437); // (21437 > 8543)
    expect(stat2Player1.claimable).to.equal(BN_L.add(BN_S).toString()); // (Token when added + update)

    const stat2Player2 = await game2.getPlayerStats(addr2.address);
    expect(stat2Player2.xp).to.equal(1200); // didn't play
    expect(stat2Player2.sessionsPlayed).to.equal(98); // didn't play
    expect(stat2Player2.rankingScore).to.equal(8746); // didn't play
    expect(stat2Player2.bestScore).to.equal(12543); // didn't play
    expect(stat2Player2.claimable).to.equal(BN_M); // didn't play

    const statPlayer3 = await game2.getPlayerStats(addr3.address);
    expect(statPlayer3.xp).to.equal(850 + 146); // (xp when added + update)
    expect(statPlayer3.sessionsPlayed).to.equal(54 + 6); // (session played when added + update)
    expect(statPlayer3.rankingScore).to.equal(10243); // (10243 > 6435)
    expect(statPlayer3.bestScore).to.equal(10243); // (10243 > 9864)
    expect(statPlayer3.claimable).to.equal(BN_S.add(BN_S).toString()); // (Token when added + update)
  });

  it("Should be possible to update then get a player login status", async function () {
    expect(await gameFactory.getLoginStatusOf(addr1.address)).to.equal(0);

    await expect(gameFactory.updatAllPlayersLogin([addr1.address, addr3.address], [true])).to.be.revertedWith(
      "Args don't match"
    );

    await gameFactory.updatAllPlayersLogin([addr1.address, addr3.address], [true, true]);
    expect(await gameFactory.getLoginStatusOf(addr1.address)).to.equal(1);
    expect(await gameFactory.getLoginStatusOf(addr2.address)).to.equal(0);
    expect(await gameFactory.getLoginStatusOf(addr3.address)).to.equal(1);

    await gameFactory.updatAllPlayersLogin([addr2.address], [false]);
    expect(await gameFactory.getLoginStatusOf(addr2.address)).to.equal(0);
  });

  it("Should be possible to get all player stats", async function () {
    // Create game 1
    const tx1 = await gameFactory.createNewGame(name1Bytes32);
    const receipt1 = await tx1.wait();
    const gameAddr1 = getAddressFromEvent(receipt1);
    const game1 = await ethers.getContractAt("Game", gameAddr1, deployer);

    // Create game 2
    const tx2 = await gameFactory.createNewGame(name1Bytes32);
    const receipt2 = await tx2.wait();
    const gameAddr2 = getAddressFromEvent(receipt2);
    const game2 = await ethers.getContractAt("Game", gameAddr2, deployer);

    // Add player to game 1 & game 2
    await game1.connect(deployer).addNewPlayer(addr1.address, 900, 114, BN_L, 1543, 10250);
    await game2.connect(deployer).addNewPlayer(addr1.address, 1500, 124, BN_L, 12543, 21437);

    // Update player in game 1
    await game1.updateAllPlayersStats([addr1.address], [14, 246, BN_S, 8543]);

    // Get global stats for player
    const globalStats = await gameFactory.getGlobalPlayerStats(addr1.address);
    expect(await globalStats.player).to.equal(addr1.address);
    expect(await globalStats.totalXp).to.equal(900 + 1500 + 246);
    expect(await globalStats.totalSessionsPlayed).to.equal(114 + 124 + 14);
    const total = BN_L.add(BN_L).add(BN_S);
    expect(await globalStats.totalClaimable).to.equal(total.toString());
    expect(await globalStats.globalWon).to.equal(total.toString());
  });

  it("Should be possible to get all player's gameId played", async function () {
    // Create game 1
    const tx1 = await gameFactory.createNewGame(name1Bytes32);
    const receipt1 = await tx1.wait();
    const gameAddr1 = getAddressFromEvent(receipt1);
    const game1 = await ethers.getContractAt("Game", gameAddr1, deployer);

    // Create game 2
    const tx2 = await gameFactory.createNewGame(name1Bytes32);
    const receipt2 = await tx2.wait();
    const gameAddr2 = getAddressFromEvent(receipt2);
    const game2 = await ethers.getContractAt("Game", gameAddr2, deployer);

    // Add player to game 1 & game 2
    await game1.connect(deployer).addNewPlayer(addr1.address, 900, 114, BN_L, 1543, 10250);
    await game1.connect(deployer).addNewPlayer(addr2.address, 700, 68, BN_S, 1143, 4250);
    await game2.connect(deployer).addNewPlayer(addr1.address, 1500, 124, BN_L, 12543, 21437);
    await game2.connect(deployer).addNewPlayer(addr2.address, 530, 57, BN_S, 943, 3650);

    // Update player in game 1
    await game1.updateAllPlayersStats([addr1.address], [14, 246, BN_S, 8543]);
    await game2.updateAllPlayersStats([addr2.address], [12, 148, BN_S, 4543]);

    expect(await game1.getTotalSessionsPlayed()).to.equal(114 + 68 + 14);
    expect(await gameFactory.getGlobalSessionsPlayed()).to.equal(114 + 68 + 14 + 124 + 57 + 12);
  });
});
