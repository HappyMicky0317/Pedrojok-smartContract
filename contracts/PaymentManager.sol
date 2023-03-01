//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

// import "hardhat/console.sol";
import "./GameFactory.sol";
import "./interfaces/IGame.sol";
import "./libraries/LevelLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Transfer / Withdraw tokens;
 * @author Pedrojok01
 * @notice Allows to transfer tokens to players that requested a withdraw;
 */

contract PaymentManager is Pausable, Ownable {
    using SafeERC20 for IERC20;

    /* Storage:
     ************/

    GameFactory private gameFactory;
    IERC20 public immutable token;
    address public paymentAddress;
    uint8 public minimumLevel = 1;
    uint256 private minimumAmount = 750 * (10**18);

    event WithdrawnBatch(address[] player, uint256[] amount);
    event MinimumAmountSet(uint256 amount);
    event MinimumLevelSet(uint8 level);
    event PaymentAddressSet(address _newPaymentAddress);

    /* Constructor:
     ***************/

    /**
     * @notice Define the token that will be used in the ecosystem, and push once to gameList for index to work properly
     * @param _token Token that will be used for payment;
     * @param _paymentAddress Address that will be used to emit the payments;
     */
    constructor(
        IERC20 _token,
        address _paymentAddress,
        address _gameFactoryAddress
    ) {
        require(_paymentAddress != address(0), "Zero address");
        token = _token;
        paymentAddress = _paymentAddress;
        gameFactory = GameFactory(_gameFactoryAddress);
    }

    /* Restricted Functions:
     ************************/

    /// @notice Allows admin to batch transfer tokens for all requested withdrawals
    function withdrawBatch(address[] calldata _to, uint256[] calldata _amounts) external onlyOwner whenNotPaused {
        uint256 array = _to.length;
        require(array == _amounts.length, "Arrays don't match");
        for (uint256 i = 0; i < array; i++) {
            _withdraw(_to[i], _amounts[i]);
        }
        emit WithdrawnBatch(_to, _amounts);
    }

    /// @notice Allows the multisig to edit the minimum withdrawable amount
    function setMinimumAmount(uint256 _newMin) external onlyOwner {
        minimumAmount = _newMin * (10**18);
        emit MinimumAmountSet(_newMin);
    }

    /// @notice Allows the multisig to edit the minimum withdrawable amount
    function setMinimumLevel(uint8 _newLevel) external onlyOwner {
        minimumLevel = _newLevel;
        emit MinimumLevelSet(_newLevel);
    }

    /// @notice Allows the multisig to edit the payment address
    function setNewPaymentAddress(address _newPaymentAddress) external onlyOwner {
        require(_newPaymentAddress != address(0), "Address 0");
        paymentAddress = _newPaymentAddress;
        emit PaymentAddressSet(_newPaymentAddress);
    }

    /* Private:
     ************/

    /// @notice Transfer tokens to players who succesfully requested a withdraw;
    function _withdraw(address _to, uint256 _amount) private {
        require(_amount > 0, "Invalid amount");
        SharedStructs.GlobalPlayerStats memory playerStats = gameFactory.getGlobalPlayerStats(_to);
        require(_amount <= playerStats.totalClaimable, "Insufficient balance");

        uint256 level = LevelLib.getLevelFromXp(playerStats.totalXp);
        require(level >= minimumLevel, "Insufficient level");

        IGame[] memory gamePlayed = gameFactory.getGameIdPlayedPerPlayer(_to);

        uint256 totalFilled = 0;
        uint256 leftToFill = _amount;

        for (uint256 i = 0; i < gamePlayed.length; i++) {
            totalFilled += gamePlayed[i].resetClaimable(_to, leftToFill);
            if (totalFilled >= _amount) {
                break;
            } else if (totalFilled < _amount) {
                leftToFill -= totalFilled;
            }
        }
        SharedStructs.GlobalPlayerStats memory balanceAfter = gameFactory.getGlobalPlayerStats(_to);
        assert(balanceAfter.totalClaimable == playerStats.totalClaimable - _amount);
        token.safeTransferFrom(paymentAddress, _to, _amount);
    }
}
