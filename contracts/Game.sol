//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

// import "hardhat/console.sol";
import "./interfaces/IGame.sol";
import "./libraries/SharedStructs.sol";
import "./libraries/RewardStructure.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Deployed for each new game via the GameFactory;
 * @author @Pedrojok01
 * @notice Allows publishers to create a new contract for each new game
 */

contract Game is IGame, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* Storage:
     ************/
    IERC20 private immutable token;
    address private constant FEE_RECEIVER = "";
    address private immutable admin; // = back-end server's address
    address private immutable paymentManager;

    bytes32 public gameName;
    uint256 public gameID;
    uint256 public activePlayersLastRanking;
    uint256 public numberOfPlayers = 0;

    mapping(address => SharedStructs.Player) public player;
    mapping(address => SharedStructs.NftsAllowed) public isNftAllowed;
    mapping(address => SharedStructs.NftStat) public nftStat;
    mapping(address => uint256) public playerIndex;
    mapping(uint256 => address) public playerAddress;

    /// @notice Triggered after each ranking reset
    event RankingReset(uint256 numOfPlayers, uint256 numOfActivePlayers, uint256 timestamp);
    event RewardsDistributed(address[10] top10, uint256 amountToDistribute, uint8[10] rewardStructure);

    modifier onlyAuthorized() {
        require(msg.sender == owner() || msg.sender == admin || msg.sender == paymentManager, "Not authorized");
        _;
    }

    /* Constructor:
     ***************/

    constructor(
        bytes32 _gameName,
        uint256 _gameID,
        address _owner,
        address _admin,
        address _paymentManager,
        IERC20 _token
    ) {
        require(_admin != address(0), "Address 0");
        require(_paymentManager != address(0), "Address 0");

        gameName = _gameName;
        gameID = _gameID;
        admin = _admin;
        paymentManager = _paymentManager;
        token = _token;
        transferOwnership(_owner);
    }

    /* Functions:
     **************/

    /**
     * @notice Add a new player (when blockchain function unlocked);
     * @param _player Array of player's addresses to update;
     * @param _xp Player's XP gained off-chain until now;
     * @param _sessionsPlayed Player's total sessions played off-chain until now;
     * @param _claimable Player's claimable amount gained off-chain until now (also == totalWon);
     * @param _rankingScore Player's best weekly score off-chain until now;
     * @param _bestScore Player's best overall score off-chain until now;
     */
    function addNewPlayer(
        address _player,
        uint256 _xp,
        uint256 _sessionsPlayed,
        uint256 _claimable,
        uint256 _rankingScore,
        uint256 _bestScore
    ) external override onlyAuthorized whenNotPaused returns (uint256 userIndex) {
        require(_player != address(0), "Address 0");
        require(playerIndex[_player] == 0, "Existing user");

        numberOfPlayers++;
        userIndex = numberOfPlayers;
        playerIndex[_player] = userIndex;
        playerAddress[userIndex] = _player;

        player[_player].user = _player;
        player[_player].xp = _xp;
        player[_player].sessionsPlayed = _sessionsPlayed;
        player[_player].claimable = _claimable;
        player[_player].totalWon = _claimable;
        player[_player].rankingScore = _rankingScore;
        player[_player].bestScore = _bestScore;

        return userIndex;
    }

    /**
     * @notice Update all players stats at once
     * @param _players Array of player's addresses to update;
     * @param _numbers Array containing all data to be updated;
     */
    function updateAllPlayersStats(address[] calldata _players, uint256[] calldata _numbers)
        external
        override
        onlyAuthorized
        whenNotPaused
    {
        require(_players.length == (_numbers.length / 4), "Wrong parameters");
        uint256 array = _players.length;
        uint256 pointer = 0; //points to user's number in numbers array
        for (uint256 i = 0; i < array; i++) {
            _updatePlayerStats(
                _players[i],
                _numbers[pointer],
                _numbers[pointer + 1],
                _numbers[pointer + 2],
                _numbers[pointer + 3]
            );
            pointer += 4;
        }
    }

    /// @notice Reinitialize all players hebdo scores
    function resetAllrankingScores() external override onlyAuthorized whenNotPaused {
        uint256 numOfPlayers = numberOfPlayers;
        uint256 numOfActivePlayers = 0;
        for (uint256 i = 1; i <= numOfPlayers; i++) {
            address playerTemp = playerAddress[i];
            uint256 temp = _resetRankingScore(playerTemp);
            if (temp > 0) {
                numOfActivePlayers++;
            }
        }
        emit RankingReset(numOfPlayers, numOfActivePlayers, block.timestamp);
        activePlayersLastRanking = numOfActivePlayers;
    }

    /**
     * @notice Allows to distribute the weekly ranking rewards
     * @param _amountToDistribute The token prize pool to be distributed
     * @param _number The number of players to rewards (see RewardStructure.sol for possible repartition)
     * ToDo: Prevent rounded number (_amountToDistribute != amountDistributed)
     */
    function distributeRewards(uint256 _amountToDistribute, uint8 _number)
        external
        override
        onlyAuthorized
        whenNotPaused
    {
        uint256 amountDistributed = 0;
        uint8[10] memory _rewardStructure = RewardStructure.getRewardStructure(_number);
        (address[10] memory _top10, ) = this.getTop10();
        uint256 array = _top10.length;

        for (uint256 i = 0; i < array; i++) {
            uint256 amountToTransfer = (_amountToDistribute * _rewardStructure[i]) / 100;
            if (amountToTransfer != 0) {
                amountDistributed += amountToTransfer;
                token.safeTransferFrom(admin, _top10[i], amountToTransfer);
            } else break;
        }
        assert(_amountToDistribute == amountDistributed);
        emit RewardsDistributed(_top10, _amountToDistribute, _rewardStructure);
    }

    /// @notice Reinitialize or update a player claimable amount during withdraw
    function resetClaimable(address _player, uint256 _amount)
        external
        override
        onlyAuthorized
        whenNotPaused
        returns (uint256 withdrawn)
    {
        uint256 balance = player[_player].claimable;

        if (_amount >= balance) {
            player[_player].claimable = 0;
            return balance;
        } else {
            player[_player].claimable -= _amount;
            return _amount;
        }
    }

    /* Functions related to NFT Boost:
     *********************************/

    /**
     * @notice Allows admin/owner to whitelist an NFT collection in the game;
     * @param _collection NFT collection address to be whitelisted;
     */
    function addAllowedCollection(address _collection) external override onlyAuthorized {
        isNftAllowed[_collection].nftContractAddress = _collection;
        isNftAllowed[_collection].isAllowed = true;
    }

    /**
     * @notice Allows admin/owner to blacklist an NFT collection in the game;
     * @param _collection NFT collection address to be blacklisted;
     */
    function removeAllowedCollection(address _collection) external override onlyAuthorized {
        isNftAllowed[_collection].isAllowed = false;
    }

    /// @notice See IGame interface;
    function setNftStatus(
        address _player,
        bool _isNFT,
        address _nftContractAddress,
        uint256 _tokenId,
        uint256 _nftBoost
    ) external override onlyAuthorized {
        _setNftStatus(_player, _isNFT, _nftContractAddress, _tokenId, _nftBoost);
    }

    /**
     * @notice Allows admin/owner to reset the NFT status of a player;
     * @param _player Player's address to reset;
     */
    function resetNftStatus(address _player) external override onlyAuthorized {
        require(_player != address(0), "Address 0");
        _resetNftStatus(_player);
    }

    /* Read Functions:
     *******************/

    /**
     * @notice Allows admin/owner to reset the NFT status of a player;
     * @param _player Player's address to check;
     */
    function isPlayerInGameId(address _player) external view override returns (bool) {
        if (player[_player].user != address(0)) {
            return true;
        } else return false;
    }

    /**
     * @notice Get all stats per player;
     * @param _player Player's address to check;
     */
    function getPlayerStats(address _player) external view override returns (SharedStructs.Player memory) {
        return player[_player];
    }

    /**
     * @notice Get Nft status per player;
     * @param _player Player's address to check;
     */
    function getPlayerNftStats(address _player) external view override returns (SharedStructs.NftStat memory) {
        return nftStat[_player];
    }

    /// @notice Get total amount of sessions played for this game;
    function getTotalSessionsPlayed() external view override returns (uint256) {
        uint256 numOfPlayers = numberOfPlayers;
        uint256 totalSessions = 0;
        for (uint256 i = 1; i <= numOfPlayers; i++) {
            address playerTemp = playerAddress[i];
            totalSessions += player[playerTemp].sessionsPlayed;
        }
        return totalSessions;
    }

    /// @notice Get Top 10 players
    function getTop10() external view override returns (address[10] memory, uint256[10] memory) {
        address[10] memory top10;
        uint256[10] memory scoreTemp;

        (top10[0], scoreTemp[0]) = _getHighestScore();

        for (uint256 i = 1; i < 9; i++) {
            (top10[i], scoreTemp[i]) = _getHighestBetween(top10[i - 1], scoreTemp[i - 1]);
        }
        return (top10, scoreTemp);
    }

    /* Private:
     ************/

    /**
     * @notice Private use;
     * @param _player Address of the player to update;
     * @param _sessionsPlayed Number of sessions played by the player since last update;
     * @param _xpWon Xp won by the player since last update;
     * @param _tokenWon Token won by the player since last update;
     * @param _score Best score realized by the player since last update;
     */
    function _updatePlayerStats(
        address _player,
        uint256 _sessionsPlayed,
        uint256 _xpWon,
        uint256 _tokenWon,
        uint256 _score
    ) private onlyAuthorized whenNotPaused {
        SharedStructs.Player memory temp = player[_player];
        temp.xp += _xpWon;
        temp.sessionsPlayed += _sessionsPlayed;
        temp.claimable += _tokenWon;
        temp.totalWon += _tokenWon;
        temp.rankingScore = temp.rankingScore >= _score ? temp.rankingScore : _score;
        temp.bestScore = temp.bestScore >= _score ? temp.bestScore : _score;

        player[_player] = temp;
    }

    /**
     * @notice Private use;
     * @param _player Player's address to reset;
     */
    function _resetRankingScore(address _player) private returns (uint256) {
        uint256 oldScore = player[_player].rankingScore;
        if (oldScore > 0) {
            player[_player].rankingScore = 0;
        }
        return oldScore;
    }

    /**
     * @notice Private use;
     * @param _player Player's address to set;
     * @param _isNFT Is a NFT used?;
     * @param _nftContractAddress Nft contract's address if used;
     * @param _tokenId Nft token ID if used;
     * @param _nftBoost Nft perks/boost to be added;
     */
    function _setNftStatus(
        address _player,
        bool _isNFT,
        address _nftContractAddress,
        uint256 _tokenId,
        uint256 _nftBoost
    ) private {
        if (_isNFT) {
            // add boost to stakeholder NFT status and keep track of start day (since)
            nftStat[_player].isNft = true;
            nftStat[_player].nftContractAddress = _nftContractAddress;
            nftStat[_player].tokenId = _tokenId;
            nftStat[_player].boostValue = _nftBoost;
            nftStat[_player].since = block.timestamp;
        }
        // Reset only if needed (NFT sold/transfered)
        else if (nftStat[_player].isNft) {
            _resetNftStatus(_player);
        }
    }

    /**
     * @notice Private use;
     * @param _player Player's address to reset;
     */
    function _resetNftStatus(address _player) private {
        nftStat[_player].isNft = false;
        nftStat[_player].nftContractAddress = address(0);
        nftStat[_player].tokenId = 0;
        nftStat[_player].boostValue = 0;
        nftStat[_player].since = 0;
    }

    /* Utils:
     **********/

    /**
     * @notice Private use;
     * @notice Return the highest uint of a given array (no sort needed!)
     */
    function _getHighestScore() private view returns (address, uint256) {
        uint256 array = numberOfPlayers;
        uint256 highest = 0;
        address player1;
        for (uint256 i = 0; i < array; i++) {
            address playerTemp = playerAddress[i];
            uint256 scoreTemp = player[playerTemp].rankingScore;
            if (scoreTemp > highest) {
                highest = scoreTemp;
                player1 = playerTemp;
            }
        }
        return (player1, highest);
    }

    /**
     * @notice Private use;
     * @notice Return the second highest uint after the uint given as parameter (no sort needed!)
     * @notice The player's address associated with highest score is used to prevent collusion;
     */
    function _getHighestBetween(address _actualPlayer, uint256 _actualHighest) private view returns (address, uint256) {
        uint256 array = numberOfPlayers;
        uint256 secondHighest = 0;
        address playerTop10;
        for (uint256 i = 0; i < array; i++) {
            address playerTemp = playerAddress[i];
            uint256 scoreTemp = player[playerTemp].rankingScore;
            if (scoreTemp == _actualHighest) {
                // Prevent duplicate if same score
                if (playerTemp != _actualPlayer) {
                    secondHighest = scoreTemp;
                    playerTop10 = playerTemp;
                }
            } else if (scoreTemp > secondHighest && scoreTemp < _actualHighest) {
                secondHighest = scoreTemp;
                playerTop10 = playerTemp;
            }
        }
        return (playerTop10, secondHighest);
    }
}
