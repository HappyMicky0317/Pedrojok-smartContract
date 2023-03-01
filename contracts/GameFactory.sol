//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

// import "hardhat/console.sol";
import "./Game.sol";

/**
 * @title Main contract of the Gamefi Platform;
 * @author Pedrojok01
 * @notice Allows to deploy new games & tracks all global variables per player;
 */

contract GameFactory is Pausable, Ownable {
    /* Storage:
     ************/

    address private admin; // Backend server
    address private paymentManager; // contract handling withdraw
    IERC20 private token;

    mapping(bytes32 => uint256) public getGameId; // Map games ID per game name
    mapping(uint256 => IGame) public getGameAddress; // Map games address per game ID
    mapping(address => uint256) private consecutiveLogin;
    IGame[] public gamesList; // Array containing all created games addresses

    event NewGameCreated(address owner, IGame indexed newGameAddress, uint256 indexed newGameID, bytes32 newGameName);
    event AdminAddressSet(address admin);
    event PaymentManagerAddressSet(address paymentManager);
    event TokenSet(IERC20 token);

    /* Functions:
     **************/

    /** 
     @dev Call this function to create a new game contract.
     @param gameName  Name of the new game. Can be chosen by user input.
    */
    function createNewGame(bytes32 gameName) external whenNotPaused returns (IGame) {
        uint256 gameID = gamesList.length;
        require(getGameAddress[gameID] == IGame(address(0)), "Game already exist");

        // call Game.sol constructor to create a new game
        IGame newGame = IGame(new Game(gameName, gameID, msg.sender, admin, paymentManager, token));

        getGameId[gameName] = gameID;
        getGameAddress[gameID] = newGame;
        gamesList.push(newGame);

        emit NewGameCreated(msg.sender, newGame, gameID, gameName);

        return newGame;
    }

    /** 
     @dev Call this function to batch-update all players Login status at once;
     @param _players Array of players' addresses;
     @param _loggedIn Array of players' login status for the past 24h;
    */
    function updatAllPlayersLogin(address[] calldata _players, bool[] calldata _loggedIn)
        external
        onlyOwner
        whenNotPaused
    {
        require(_players.length == _loggedIn.length, "Args don't match");
        uint256 array = _players.length;
        for (uint256 i = 0; i < array; i++) {
            if (_loggedIn[i]) {
                _updatePlayerLogin(_players[i]);
            }
        }
    }

    /* View Functions:
     *******************/
    /// @notice Return a game instance from a game ID;
    function getGamePerIndex(uint256 _gameId) external view returns (IGame) {
        return gamesList[_gameId];
    }

    /// @notice Get amount of games;
    function getNumberOfGames() external view returns (uint256) {
        return gamesList.length;
    }

    /// @notice Get player login status;
    function getLoginStatusOf(address _player) external view returns (uint256) {
        return consecutiveLogin[_player];
    }

    /// @notice Get total amount of sessions played on the platform;
    function getGlobalSessionsPlayed() external view returns (uint256) {
        uint256 array = gamesList.length;
        uint256 globalPlayed = 0;

        for (uint256 i = 0; i < array; i++) {
            IGame game = this.getGamePerIndex(i);
            globalPlayed += game.getTotalSessionsPlayed();
        }
        return globalPlayed;
    }

    /// @notice Get all stats per player;
    function getGlobalPlayerStats(address _player) external view returns (SharedStructs.GlobalPlayerStats memory) {
        SharedStructs.GlobalPlayerStats memory temp;
        temp.player = _player;
        uint256 array = gamesList.length;

        for (uint256 i = 0; i < array; i++) {
            IGame game = gamesList[i];
            SharedStructs.Player memory player = game.getPlayerStats(_player);
            temp.totalXp += player.xp;
            temp.totalSessionsPlayed += player.sessionsPlayed;
            temp.totalClaimable += player.claimable;
            temp.globalWon += player.totalWon;
        }
        temp.consecutiveLogin = consecutiveLogin[_player];
        return temp;
    }

    /// @notice Get all stats per player;
    function getGameIdPlayedPerPlayer(address _player) external view returns (IGame[] memory) {
        uint256 array = gamesList.length;
        IGame[] memory temp = new IGame[](array);
        uint256 index = 0;

        for (uint256 i = 0; i < array; i++) {
            IGame game = gamesList[i];
            bool isPlayer = game.isPlayerInGameId(_player);
            if (isPlayer) {
                temp[index] = game;
                index++;
            }
        }
        return temp;
    }

    /* Restricted:
     **************/

    /// @notice Allows to set the admin address (must be passed in game creation)
    function setAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Address 0");
        admin = _admin;
        emit AdminAddressSet(_admin);
    }

    /// @notice Allows to set the PaymentManager address (must be passed in game creation)
    function setPaymentManager(address _paymentManager) external onlyOwner {
        require(_paymentManager != address(0), "Address 0");
        paymentManager = _paymentManager;
        emit PaymentManagerAddressSet(_paymentManager);
    }

    /// @notice Allows to set the PaymentManager address (must be passed in game creation)
    function setToken(IERC20 _token) external onlyOwner {
        token = _token;
        emit TokenSet(_token);
    }

    /* Private:
     ************/

    function _updatePlayerLogin(address _player) private {
        consecutiveLogin[_player]++;
    }
}
