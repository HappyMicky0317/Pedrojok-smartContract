// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Test Token
 * @notice Basic ERC20 Token, where all tokens are pre-assigned to the creator;
 * @dev multiTransfer & multiTransferFrom functions addtion for batch transfer;
 */

abstract contract MultiTransfer is ERC20 {
    /**
     * @dev Make multiple token transfers with one transaction.
     * @param to Array of addresses to transfer to.
     * @param value Array of amounts to be transferred.
     */
    function multiTransfer(address[] memory to, uint256[] memory value) public returns (bool) {
        require(to.length > 0, "Empty array");
        require(value.length == to.length, "Length mismatched");

        for (uint256 i = 0; i < to.length; i++) {
            _transfer(msg.sender, to[i], value[i]);
        }
        return true;
    }

    /**
     * @dev Transfer tokens from one address to multiple others.
     * @param from Address to send from.
     * @param to Array of addresses to transfer to.
     * @param value Array of amounts to be transferred.
     *
     * Blockwell Exclusive (Intellectual Property that lives on-chain via Smart License)
     */
    function multiTransferFrom(
        address from,
        address[] memory to,
        uint256[] memory value
    ) public returns (bool) {
        require(to.length > 0, "Empty array");
        require(value.length == to.length, "Length mismatched");

        for (uint256 i = 0; i < to.length; i++) {
            _spendAllowance(from, to[i], value[i]);
            _transfer(from, to[i], value[i]);
        }
        return true;
    }
}

contract TestToken is MultiTransfer {
    /**
     * @dev Constructor that gives msg.sender all of existing tokens.
     */
    constructor() ERC20("Test Token", "TST") {
        _mint(msg.sender, 100000000000 * (10**uint256(decimals())));
    }
}
