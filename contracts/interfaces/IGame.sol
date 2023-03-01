//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../libraries/SharedStructs.sol";

/**
 * @title Interface for Game.sol contract;
 * @author @Pedrojok01
 * @notice Allows the factory to communicate with each game;
 */

interface IGame {
    /**
     * @notice Add a new player  (when blockchain function unlocked)
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
    ) external returns (uint256 userIndex);

    /**
     * @notice Update all players stats at once
     * @param _players Array of player's addresses to update;
     * @param _numbers Array containing all data to be updated. Numbers, in order, are:
     *  [uint256 _sessionsPlayed, uint256 _xpWon, uint256 _tokenWon, uint256 _score];
     */
    function updateAllPlayersStats(address[] calldata _players, uint256[] calldata _numbers) external;

    /// @notice Reinitialize all players hebdo scores
    function resetAllrankingScores() external;

    /**
     * @notice Distribute ranking rewards to Top players
     * @param _amountToDistribute Total amount of tokens to be distributed to the Top ranks;
     * @param _number Distribution repartition (see RewardStructure.sol library)
     */
    function distributeRewards(uint256 _amountToDistribute, uint8 _number) external;

    /**
     * @notice Reinitialize or update a player claimable amount after a withdraw;
     * @param _player Player's address;
     * @param _amount Amount withdrawn;
     */
    function resetClaimable(address _player, uint256 _amount) external returns (uint256 withdrawn);

    /* Functions related to NFT Boost:
     *********************************/

    /**
     * @notice Whitelist an NFts collection in a game;
     * @param _collection Contract address of the NFTs collection to be whitelisted;
     */
    function addAllowedCollection(address _collection) external;

    /**
     * @notice Blacklist an NFts collection in a game;
     * @param _collection Contract address of the NFTs collection to be blacklisted;
     */
    function removeAllowedCollection(address _collection) external;

    /**
     * @notice Whitelist an NFts collection in a game;
     * @param _account Player's address to update;
     * @param _isNFT Activate/desactivate the NFT's effect;
     * @param _nftContractAddress NFT's contract address;
     * @param _tokenId NFT's TokenID;
     * @param _nftBoost NFT's effect;
     */
    function setNftStatus(
        address _account,
        bool _isNFT,
        address _nftContractAddress,
        uint256 _tokenId,
        uint256 _nftBoost
    ) external;

    /// @notice Reinitialize a players NFT status
    /// @param _player Player's address to reset;
    function resetNftStatus(address _player) external;

    /* View Functions:
     *******************/

    /**
     * @notice Check is a player played a specific Game ID;
     * @param _player Player's address to be checked;
     * @return Bool True if player exist || False if not;
     */
    function isPlayerInGameId(address _player) external view returns (bool);

    /// @notice Get all stats per player;
    /// @param _player Player's address to be checked;
    function getPlayerStats(address _player) external view returns (SharedStructs.Player memory);

    /// @notice Get Nft status per player;
    /// @param _player Player's address to be checked;
    function getPlayerNftStats(address _player) external view returns (SharedStructs.NftStat memory);

    /// @notice Get total amount of sessions played for a game
    function getTotalSessionsPlayed() external view returns (uint256);

    /// @notice Get Top 10 players
    function getTop10() external view returns (address[10] memory, uint256[10] memory);
}
