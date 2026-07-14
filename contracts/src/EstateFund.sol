// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EstateFund — a transparent onchain levy fund for residential estates.
/// @notice Residents pay levies that are publicly attributed to their unit. The chairman
///         cannot move funds without an onchain expense proposal carrying a plain-language
///         memo that must survive a public delay window — during which a resident majority
///         can block it. No funds ever leave silently or unattributed.
/// @dev Events ARE the ledger: the frontend renders them verbatim. One contract, no external
///      dependencies, hand-rolled reentrancy guard to stay lean.
contract EstateFund {
    // ------------------------------------------------------------------ types

    struct Estate {
        string name;
        address chairman;
        uint256 balance; // fund balance held by this contract for the estate
        uint256 residentCount;
        uint64 proposalDelay; // seconds an expense must wait before execution
        bool exists;
    }

    struct Resident {
        string unitLabel; // "Block C, Flat 4"
        bool active;
    }

    struct Expense {
        address recipient;
        uint256 amount;
        string memo; // "Diesel — 500L — July"
        uint64 proposedAt;
        uint32 objections;
        bool executed;
        bool cancelled;
    }

    // ---------------------------------------------------------------- storage

    mapping(uint256 => Estate) public estates; // estateId => Estate
    mapping(uint256 => mapping(address => Resident)) public residents; // estateId => addr => Resident
    mapping(uint256 => Expense[]) public expenses; // estateId => proposals
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasObjected;
    mapping(uint256 => bytes32) private joinCodeHash; // estateId => keccak256(code)
    uint256 public estateCount;

    uint64 public constant MIN_DELAY = 60; // 1 minute
    uint64 public constant MAX_DELAY = 7 days;

    uint256 private _reentrancyStatus = 1; // 1 = unlocked, 2 = locked

    // ----------------------------------------------------------------- events

    event EstateCreated(
        uint256 indexed estateId, string name, address indexed chairman, uint64 proposalDelay
    );
    event ResidentJoined(uint256 indexed estateId, address indexed resident, string unitLabel);
    event LevyPaid(
        uint256 indexed estateId,
        address indexed resident,
        uint256 amount,
        string period,
        string unitLabel
    );
    event ExpenseProposed(
        uint256 indexed estateId,
        uint256 indexed expenseId,
        address recipient,
        uint256 amount,
        string memo,
        uint64 executableAt
    );
    event ExpenseObjected(
        uint256 indexed estateId,
        uint256 indexed expenseId,
        address indexed resident,
        uint32 totalObjections
    );
    event ExpenseExecuted(
        uint256 indexed estateId,
        uint256 indexed expenseId,
        address recipient,
        uint256 amount,
        string memo
    );
    event ExpenseCancelled(uint256 indexed estateId, uint256 indexed expenseId, string reason);

    // -------------------------------------------------------------- modifiers

    modifier nonReentrant() {
        require(_reentrancyStatus == 1, "reentrant");
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    modifier estateExists(uint256 id) {
        require(estates[id].exists, "no such estate");
        _;
    }

    modifier onlyChairman(uint256 id) {
        require(msg.sender == estates[id].chairman, "not chairman");
        _;
    }

    modifier onlyResident(uint256 id) {
        require(residents[id][msg.sender].active, "not a resident");
        _;
    }

    // ---------------------------------------------------------- membership

    /// @notice Create a new estate. Caller becomes chairman and is auto-registered as a resident.
    function createEstate(string calldata name, bytes32 joinCodeHash_, uint64 proposalDelay_)
        external
        returns (uint256 id)
    {
        require(bytes(name).length > 0, "empty name");
        require(proposalDelay_ >= MIN_DELAY && proposalDelay_ <= MAX_DELAY, "bad delay");

        id = estateCount++;
        estates[id] = Estate({
            name: name,
            chairman: msg.sender,
            balance: 0,
            residentCount: 0,
            proposalDelay: proposalDelay_,
            exists: true
        });
        joinCodeHash[id] = joinCodeHash_;

        emit EstateCreated(id, name, msg.sender, proposalDelay_);

        // chairman auto-registered as a resident
        _register(id, msg.sender, "Chairman");
    }

    /// @notice Join an existing estate by supplying its join code and your unit label.
    function joinEstate(uint256 id, string calldata code, string calldata unitLabel)
        external
        estateExists(id)
    {
        require(!residents[id][msg.sender].active, "already a resident");
        require(keccak256(bytes(code)) == joinCodeHash[id], "bad code");
        require(bytes(unitLabel).length > 0, "empty unit");
        _register(id, msg.sender, unitLabel);
    }

    function _register(uint256 id, address who, string memory unitLabel) internal {
        residents[id][who] = Resident({unitLabel: unitLabel, active: true});
        estates[id].residentCount += 1;
        emit ResidentJoined(id, who, unitLabel);
    }

    // --------------------------------------------------------------- levies

    /// @notice Pay a levy into the estate fund, attributed to your unit.
    function payLevy(uint256 id, string calldata period)
        external
        payable
        estateExists(id)
        onlyResident(id)
    {
        require(msg.value > 0, "zero value");
        estates[id].balance += msg.value;
        emit LevyPaid(id, msg.sender, msg.value, period, residents[id][msg.sender].unitLabel);
    }

    // ------------------------------------------------------------ proposals

    /// @notice Chairman proposes an expense. It becomes executable only after the delay window.
    function proposeExpense(uint256 id, address recipient, uint256 amount, string calldata memo)
        external
        estateExists(id)
        onlyChairman(id)
        returns (uint256 expenseId)
    {
        require(recipient != address(0), "zero recipient");
        require(amount > 0 && amount <= estates[id].balance, "bad amount");
        require(bytes(memo).length > 0, "empty memo");

        uint64 proposedAt = uint64(block.timestamp);
        expenses[id].push(
            Expense({
                recipient: recipient,
                amount: amount,
                memo: memo,
                proposedAt: proposedAt,
                objections: 0,
                executed: false,
                cancelled: false
            })
        );
        expenseId = expenses[id].length - 1;
        uint64 executableAt = proposedAt + estates[id].proposalDelay;
        emit ExpenseProposed(id, expenseId, recipient, amount, memo, executableAt);
    }

    /// @notice A resident objects to a pending expense during its delay window.
    ///         If a strict majority of residents object, the expense auto-cancels.
    function objectToExpense(uint256 id, uint256 expenseId)
        external
        estateExists(id)
        onlyResident(id)
    {
        Expense storage e = expenses[id][expenseId];
        require(!e.executed && !e.cancelled, "not pending");
        require(
            block.timestamp < uint256(e.proposedAt) + estates[id].proposalDelay, "window closed"
        );
        require(!hasObjected[id][expenseId][msg.sender], "already objected");

        hasObjected[id][expenseId][msg.sender] = true;
        e.objections += 1;
        emit ExpenseObjected(id, expenseId, msg.sender, e.objections);

        // strict majority of current residents => auto-cancel
        if (uint256(e.objections) * 2 > estates[id].residentCount) {
            e.cancelled = true;
            emit ExpenseCancelled(id, expenseId, "majority objection");
        }
    }

    /// @notice Chairman executes an expense after the full delay has elapsed.
    function executeExpense(uint256 id, uint256 expenseId)
        external
        estateExists(id)
        onlyChairman(id)
        nonReentrant
    {
        Expense storage e = expenses[id][expenseId];
        require(!e.executed && !e.cancelled, "not pending");
        require(
            block.timestamp >= uint256(e.proposedAt) + estates[id].proposalDelay, "still in delay"
        );
        require(e.amount <= estates[id].balance, "insufficient balance");

        // effects before interaction
        e.executed = true;
        estates[id].balance -= e.amount;

        (bool ok,) = e.recipient.call{value: e.amount}("");
        require(ok, "transfer failed");

        emit ExpenseExecuted(id, expenseId, e.recipient, e.amount, e.memo);
    }

    /// @notice Chairman voluntarily cancels a pending expense before execution.
    function cancelExpense(uint256 id, uint256 expenseId)
        external
        estateExists(id)
        onlyChairman(id)
    {
        Expense storage e = expenses[id][expenseId];
        require(!e.executed && !e.cancelled, "not pending");
        e.cancelled = true;
        emit ExpenseCancelled(id, expenseId, "chairman cancelled");
    }

    // ----------------------------------------------------------------- views

    function getExpense(uint256 id, uint256 expenseId) external view returns (Expense memory) {
        return expenses[id][expenseId];
    }

    function getExpenseCount(uint256 id) external view returns (uint256) {
        return expenses[id].length;
    }

    function isResident(uint256 id, address who) external view returns (bool) {
        return residents[id][who].active;
    }

    // -------------------------------------------------------------- fallback

    /// @dev Reject direct transfers so no funds are ever held unattributed. Use payLevy.
    receive() external payable {
        revert("use payLevy");
    }

    fallback() external payable {
        revert("use payLevy");
    }
}
