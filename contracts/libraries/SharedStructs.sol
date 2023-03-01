// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
 * @title Library shared between multiple contracts;
 * @author Pedrojok01
 * @notice Allows the contracts to interact with those struct;
 */

library SharedStructs {
    /// @notice Track all datas per player
    struct Player {
        address user;
        uint256 xp;
        uint256 sessionsPlayed;
        uint256 claimable;
        uint256 totalWon;
        uint256 rankingScore;
        uint256 bestScore;
    }

    /// @notice Tracks allowed NFT collections
    struct NftsAllowed {
        address nftContractAddress;
        bool isAllowed;
    }

    /// @notice Track the NFT status per player
    struct NftStat {
        bool isNft;
        address nftContractAddress;
        uint256 tokenId;
        uint256 boostValue;
        uint256 since;
    }

    /// @notice Allows to get the general stats per player
    struct GlobalPlayerStats {
        address player;
        uint256 totalXp;
        uint256 totalSessionsPlayed;
        uint256 totalClaimable;
        uint256 globalWon;
        uint256 consecutiveLogin;
    }
}
